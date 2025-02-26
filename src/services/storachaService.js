import { create } from "@web3-storage/w3up-client";
import dotenv from "dotenv";
dotenv.config();

async function initializeClient() {
    try {
        console.log("🛠 Initializing Storacha client...");
        const client = await create();
        console.log("🔑 Logging in to Storacha...");
        const account = await client.login(process.env.STORACHA_EMAIL);
        console.log(`✅ Logged into Storacha with email: ${process.env.STORACHA_EMAIL}`);
        return { client, account };
    } catch (error) {
        console.error("❌ Error initializing client:", error);
        throw error;
    }
}

async function waitForPlanActivation(account) {
    try {
        console.log("⏳ Waiting for payment plan activation...");
        await account.plan.wait();
        console.log("✅ Payment plan confirmed.");
    } catch (error) {
        console.error("❌ Error waiting for plan activation:", error);
        throw error;
    }
}

export async function uploadToStoracha(fileBuffer, fileName) {
    try {
        const { client, account } = await initializeClient();
        await waitForPlanActivation(account);

        console.log("🔍 Fetching user's current space...");
        const res = await account.agent.getSpaceInfo();
        if (!res || !res.did) {
            throw new Error("❌ No space found! Please create a new space first.");
        }

        const space = res;
        await client.setCurrentSpace(space.did);
        console.log(`✅ Using existing space: ${space.did}`);

        const file = new File([fileBuffer], fileName);
        console.log(`📤 Uploading file: ${fileName}...`);
        const cid = await client.uploadFile(file);
        console.log(`✅ File uploaded successfully! CID: ${cid}`);

        return { success: true, url: `https://${cid}.ipfs.w3s.link` };
    } catch (error) {
        console.error("❌ Error uploading file to Storacha:", error);
        return { success: false, url: null };
    }
}

export async function uploadDirectoryToStoracha(filesArray) {
    try {
        const { client, account } = await initializeClient();
        await waitForPlanActivation(account);

        console.log("🔍 Fetching user's current space...");
        const res = await account.agent.getSpaceInfo();
        if (!res || !res.did) {
            throw new Error("❌ No space found! Please create a new space first.");
        }

        const space = res;
        await client.setCurrentSpace(space.did);
        console.log(`✅ Using existing space: ${space.did}`);

        const files = filesArray.map(({ buffer, fileName }) => new File([buffer], fileName));

        console.log(`📂 Uploading ${files.length} files as a directory...`);
        const directoryCid = await client.uploadDirectory(files);
        console.log(`✅ Directory uploaded successfully! CID: ${directoryCid}`);

        return { success: true, url: `https://${directoryCid}.ipfs.w3s.link` };
    } catch (error) {
        console.error("❌ Error uploading directory to Storacha:", error);
        return { success: false, url: null };
    }
}

export async function createNewStorachaSpace(spaceName) {
    try {
        console.log(`🚀 Creating new Storacha space: ${spaceName}...`);
        const { client, account } = await initializeClient();
        await waitForPlanActivation(account);

        const space = await client.createSpace(spaceName, { account });
        await client.setCurrentSpace(space.did());
        console.log(`✅ New space created and set as current: ${spaceName} (DID: ${space.did()})`);
        return { success: true, did: space.did() };
    } catch (error) {
        console.error("❌ Error creating new Storacha space:", error);
        return { success: false, did: null };
    }
}

export async function setCurrentSpaceByDID(did) {
    try {
        console.log(`🔄 Setting current space to DID: ${did}...`);
        const { account, client } = await initializeClient();
        const res = await account.agent.getSpaceInfo();
        console.log(`📍 Current Space: ${res.did}`);
        await client.setCurrentSpace(did);
        console.log(`✅ Successfully set current space to: ${did}`);
        return { success: true };
    } catch (error) {
        console.error("❌ Error setting current space by DID:", error);
        return { success: false };
    }
}
