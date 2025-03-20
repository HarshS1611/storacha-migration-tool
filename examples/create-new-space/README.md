# Basic Migration Example

This example demonstrates how to use the Storacha Migration Tool to creae a new space using Storacha (Web3.Storage).

## Setup

1. First, build and link the main library:
```bash
# In the root directory (storacha-migration-tool)
npm install
npm run build
npm link
```

2. Set up the example project:
```bash
# In examples/create-new-space
npm install
npm link storacha-migration-tool
```

3. Create a `.env` file in this directory with your credentials:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET_NAME=your_bucket_name
S3_REGION=your_region
STORACHA_EMAIL=your_email@example.com
```

## Running the Example

```bash
npm run start
```

This will:
1. Initialize the storacha client with your credentials
2. Create a random new name
3. Set the current space with the new name.

## Example Output

```
🚀 Creating New space...

[INFO] 🏗 Creating new space: Delta-1742449509981
🚀 Creating new Storacha space: Delta-1742449509981...
🛠 Initializing Storacha client...
🔑 Logging in to Storacha...
✅ Logged into Storacha with email: example@gmail.com
⏳ Waiting for payment plan activation...
✅ Payment plan confirmed.
✅ New space created and set as current: Delta-1742449509981 (DID: did:key:your_key)

✅ New space created successfully!
```

## Troubleshooting

If you encounter any issues:

1. Make sure you've built the main library:
```bash
cd ../..
npm run build
```

2. Try relinking:
```bash
# In the root directory
npm link

# In examples/create-new-space
npm link storacha-migration-tool
```

3. Check your .env file has all required credentials

4. Verify your AWS credentials have proper permissions

## Modifying the Example

The example code in `index.ts` shows how to:
- Configure the migrator
- Create new space
- Handle errors

Feel free to modify the configuration or try different migration scenarios! 