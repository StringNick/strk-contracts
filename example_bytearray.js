import { Account, Contract, RpcProvider, stark, uint256, shortString, byteArray, CallData } from 'starknet';
import crypto from 'crypto';

import fs from 'fs';

// Configuration
const PROVIDER_URL = 'https://madara-zkgenomics-l3.karnot.xyz';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const ACCOUNT_ADDRESS = process.env.ACCOUNT_ADDRESS;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;


// Generate random bytes
function generateRandomBytes(size) {
  return Array.from(crypto.randomBytes(size));
}

// Convert byte array to hex for visualization
function bytesToHex(bytes, maxDisplay = 64) {
  const hex = bytes.slice(0, maxDisplay).map(b => b.toString(16).padStart(2, '0')).join('');
  const suffix = bytes.length > maxDisplay ? '...' : '';
  return `0x${hex}${suffix}`;
}

// Calculate checksum for verification
function calculateChecksum(bytes) {
  return bytes.reduce((sum, byte) => (sum + byte) % 256, 0);
}

// Helper function to create ByteArray from raw bytes
function createByteArrayFromBytes(bytes) {
  const chunks = [];
  const CHUNK_SIZE = 31; // Each felt252 can hold 31 bytes

  // Split bytes into 31-byte chunks
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    if (chunk.length === CHUNK_SIZE) {
      // Convert chunk to big integer and then to decimal string
      let value = 0n;
      for (let j = 0; j < chunk.length; j++) {
        value = (value << 8n) + BigInt(chunk[j]);
      }
      chunks.push(value.toString()); // Use decimal string, not hex
    }
  }

  // Handle remaining bytes (pending word)
  const remainingBytes = bytes.slice(chunks.length * CHUNK_SIZE);
  let pendingWord = '0';
  let pendingWordLen = 0;

  if (remainingBytes.length > 0) {
    let value = 0n;
    for (let j = 0; j < remainingBytes.length; j++) {
      value = (value << 8n) + BigInt(remainingBytes[j]);
    }
    pendingWord = value.toString(); // Use decimal string, not hex
    pendingWordLen = remainingBytes.length;
  }

  return {
    data: chunks,
    pending_word: pendingWord,
    pending_word_len: pendingWordLen
  };
}

// Helper function to extract bytes from ByteArray
function extractBytesFromByteArray(byteArray) {
  const bytes = [];

  // Process full chunks (31 bytes each)
  for (const chunk of byteArray.data) {
    // Convert decimal string to BigInt, then extract bytes
    const value = BigInt(chunk);
    const chunkBytes = [];
    let tempValue = value;

    // Extract 31 bytes from the felt252 value
    for (let i = 0; i < 31; i++) {
      chunkBytes.unshift(Number(tempValue & 0xFFn));
      tempValue = tempValue >> 8n;
    }
    bytes.push(...chunkBytes);
  }

  // Process pending word
  if (byteArray.pending_word_len > 0) {
    const pendingValue = BigInt(byteArray.pending_word);
    const pendingBytes = [];
    let tempValue = pendingValue;

    // Extract only the specified number of pending bytes
    for (let i = 0; i < byteArray.pending_word_len; i++) {
      pendingBytes.unshift(Number(tempValue & 0xFFn));
      tempValue = tempValue >> 8n;
    }
    bytes.push(...pendingBytes);
  }

  return bytes;
}

// Generate large random data with patterns for testing
function generateTestData(size, pattern = 'random') {
  switch (pattern) {
    case 'random':
      return Array.from(crypto.randomBytes(size));

    case 'sequential':
      return Array.from({ length: size }, (_, i) => i % 256);

    case 'repeating':
      const repeatPattern = [0xAA, 0xBB, 0xCC, 0xDD];
      return Array.from({ length: size }, (_, i) => repeatPattern[i % repeatPattern.length]);

    case 'alternating':
      return Array.from({ length: size }, (_, i) => i % 2 === 0 ? 0xFF : 0x00);

    default:
      return Array.from(crypto.randomBytes(size));
  }
}

async function main() {
  try {
    console.log('🚀 ByteArray Storage Demo - Large Data Handling\n');

    // Initialize provider and account
    const provider = new RpcProvider({ nodeUrl: PROVIDER_URL });
    const account = new Account(provider, ACCOUNT_ADDRESS, PRIVATE_KEY, "1");

    // Check account details and nonce
    console.log('🔍 Account Details:');
    console.log(`   Address: ${ACCOUNT_ADDRESS}`);
    
    try {
      const currentNonce = await account.getNonce();
      console.log(`   Current Nonce: ${currentNonce}`);
    } catch (nonceError) {
      console.log(`   Nonce check failed: ${nonceError.message}`);
    }

    // casm madara_example_ByteStorage.compiled_contract_class.json
    const casm = require('./target/dev/madara_example_ByteStorage.compiled_contract_class.json');
    const compiledSierra = require('./target/dev/madara_example_ByteStorage.contract_class.json');

    // const declareAndDeployResponse = await account.declareAndDeploy({
    //   contract: compiledSierra,
    //   casm: casm,
    // }, {
    //   resourceBounds: {
    //     l1_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
    //     l2_gas: { max_amount: '0x0', max_price_per_unit: '0x0' },
    //   },
    //   maxFee: '0x0'
    // });

    // console.log('ByteStorage Contract Class Hash =', declareResponse.class_hash, declareResponse);
    

    // Connect the new contract instance:
    const contract = new Contract(
      compiledSierra.abi,
      CONTRACT_ADDRESS,
      provider,
    );

  
    contract.connect(account);

    // Test text storage using built-in ByteArray functions first
    console.log('📝 Testing Text Storage with Built-in ByteArray Functions');
    console.log('='.repeat(60));

    const testTexts = [
      // 'Hello, Starknet!',
      // 'This is a longer text message that should be stored efficiently in a ByteArray.',
      // 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
      // Test with random-like data as base64 encoded string
      // 'VGhpcyBpcyBhIHRlc3Qgb2YgcmFuZG9tLWxvb2tpbmcgZGF0YSBlbmNvZGVkIGFzIGJhc2U2NA==',
      // Larger text
      '1234567890'.repeat(10) // 10 characters * 100 * 128 bytes = 128000 bytes = 1.28mb
    ];

    for (const text of testTexts) {
      console.log(`\n📄 Testing text: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
      console.log(`   Length: ${text.length} characters`);

      // Store text using built-in function
      const startTextStore = Date.now();
      // const textByteArray = byteArray.byteArrayFromString(text);
      // console.log(`   ByteArray structure:`, JSON.stringify(textByteArray, null, 2));

      const myCalldata = CallData.compile([byteArray.byteArrayFromString(text)]);
      console.log(`   My calldata:`, myCalldata);

      // Get current nonce before transaction
      const currentNonce = await account.getNonce();
      // const nonce = BigInt(currentNonce) + 1n;
      // console.log(`   Using nonce: ${nonce.toString(16)}`);


      const storeTextCall = await contract.store_byte_array(myCalldata, {
        maxFee: '0x0',
        nonce: currentNonce,
      });
      
      console.log(`   🔄 Waiting for transaction: ${storeTextCall.transaction_hash}`);
      await provider.waitForTransaction(storeTextCall.transaction_hash);
      const textStoreTime = Date.now() - startTextStore;

      console.log(`   ✅ Stored in ${textStoreTime}ms`);
      console.log(`   📄 TX: ${storeTextCall.transaction_hash}`);

      // Retrieve text
      const startTextRetrieve = Date.now();
      const retrievedTextByteArray = await contract.get_byte_array();
      console.log(`   Retrieved text byte array:`, retrievedTextByteArray);
      // const retrievedText = byteArray.stringFromByteArray(retrievedTextByteArray);
      const textRetrieveTime = Date.now() - startTextRetrieve;

      console.log(`   ✅ Retrieved in ${textRetrieveTime}ms`);
      // console.log(`   🔍 Text match: ${text === retrievedText ? '✅ PASS' : '❌ FAIL'}`);

      // if (text !== retrievedText) {
      //   console.log(`   Expected: "${text}"`);
      //   console.log(`   Got: "${retrievedText}"`);
      // }

      // Performance metrics
      const totalTime = textStoreTime + textRetrieveTime;
      const throughput = Math.round((text.length * 2 * 1000) / totalTime);
      console.log(`   ⚡ Total time: ${totalTime}ms`);
      console.log(`   📈 Throughput: ${throughput} chars/second`);

      // Add a small delay between transactions to avoid nonce conflicts
      console.log(`   ⏳ Waiting 2 seconds before next transaction...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.message) {
      console.error('   Message:', error.message);
    }
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
  }
}

// Run the ByteArray demo
main(); 