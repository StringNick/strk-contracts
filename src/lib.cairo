#[starknet::interface]
trait IByteStorage<T> {
    // New functions for byte array storage
    fn store_bytes(ref self: T, bytes: Array<u8>);
    fn get_bytes(self: @T) -> Array<u8>;
    fn store_byte_array(ref self: T, data: ByteArray);
    fn get_byte_array(self: @T) -> ByteArray;
    fn store_byte_at_index(ref self: T, index: u32, byte_value: u8);
    fn get_byte_at_index(self: @T, index: u32) -> u8;
}

#[starknet::contract]
mod ByteStorage {
    use starknet::storage::{ 
        StoragePointerReadAccess, 
        StoragePointerWriteAccess,
        Map,
        StorageMapReadAccess,
        StorageMapWriteAccess
    };

    #[storage]
    struct Storage {
        // Store array length and use a map for individual bytes
        bytes_length: u32,
        bytes_data: Map<u32, u8>,
        // Store a ByteArray directly (recommended for larger byte sequences)
        byte_array_data: ByteArray,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.bytes_length.write(0);
    }

    #[abi(embed_v0)]
    impl ByteStorage of super::IByteStorage<ContractState> {
        // Store an array of bytes using Map storage
        fn store_bytes(ref self: ContractState, bytes: Array<u8>) {
            let length = bytes.len();
            self.bytes_length.write(length);
            
            let mut i = 0;
            while i != length {
                self.bytes_data.write(i, *bytes.at(i));
                i += 1;
            };
        }

        // Retrieve the array of bytes from Map storage
        fn get_bytes(self: @ContractState) -> Array<u8> {
            let length = self.bytes_length.read();
            let mut bytes = ArrayTrait::new();
            
            let mut i = 0;
            while i != length {
                bytes.append(self.bytes_data.read(i));
                i += 1;
            };
            
            bytes
        }

        // Store using ByteArray (more efficient for larger byte sequences)
        fn store_byte_array(ref self: ContractState, data: ByteArray) {
            self.byte_array_data.write(data);
        }

        // Retrieve ByteArray
        fn get_byte_array(self: @ContractState) -> ByteArray {
            self.byte_array_data.read()
        }

        // Store a single byte at a specific index
        fn store_byte_at_index(ref self: ContractState, index: u32, byte_value: u8) {
            self.bytes_data.write(index, byte_value);
            
            // Update length if this index is beyond current length
            let current_length = self.bytes_length.read();
            if index >= current_length {
                self.bytes_length.write(index + 1);
            }
        }

        // Get a single byte at a specific index
        fn get_byte_at_index(self: @ContractState, index: u32) -> u8 {
            assert(index < self.bytes_length.read(), 'Index out of bounds');
            self.bytes_data.read(index)
        }
    }
}