import base64
from cryptography.hazmat.primitives.asymmetric import ec

def generate_vapid_keys():
    # Generate private key using SECP256R1 curve (standard for web push VAPID)
    private_key = ec.generate_private_key(ec.SECP256R1())
    
    # Extract private key bytes (raw scalar D, 32 bytes)
    private_value = private_key.private_numbers().private_value
    private_bytes = private_value.to_bytes(32, byteorder='big')
    
    # Extract public key bytes (65 bytes uncompressed: 0x04 + X + Y)
    public_numbers = private_key.public_key().public_numbers()
    x_bytes = public_numbers.x.to_bytes(32, byteorder='big')
    y_bytes = public_numbers.y.to_bytes(32, byteorder='big')
    public_bytes = b'\x04' + x_bytes + y_bytes
    
    # Base64 URL-safe encode without padding
    private_base64 = base64.urlsafe_b64encode(private_bytes).decode('utf-8').rstrip('=')
    public_base64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')
    
    print("\n--- NEW VAPID KEYS GENERATED ---")
    print(f"VAPID_PUBLIC_KEY={public_base64}")
    print(f"VAPID_PRIVATE_KEY={private_base64}")
    print("--------------------------------\n")
    print("Add these to your .env file.")

if __name__ == "__main__":
    generate_vapid_keys()
