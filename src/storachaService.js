import { create } from "@web3-storage/w3up-client";
import dotenv from "dotenv";
dotenv.config();

async function initializeClient() {
    try {
        console.log("Initializing Storacha client...");
        const client = await create();
        console.log("Logging in to Storacha...");
        const account = await client.login(process.env.STORACHA_EMAIL);
        console.log("Logged into Storacha with email:", process.env.STORACHA_EMAIL);
        return { client, account };
    } catch (error) {
        console.error("Error initializing client:", error);
        throw error;
    }
}

async function waitForPlanActivation(account) {
    try {
        console.log("Waiting for payment plan activation...");
        await account.plan.wait();
        console.log("Payment plan confirmed.");
    } catch (error) {
        console.error("Error waiting for plan activation:", error);
        throw error;
    }
}

export async function createNewStorachaSpace(spaceName) {
    try {
        console.log("Creating new Storacha space...");
        const { client, account } = await initializeClient();
        await waitForPlanActivation(account);

        const space = await client.createSpace(spaceName,{account});
        await client.setCurrentSpace(space.did());
        console.log("New space created and set as current:", spaceName);
        return { success: true, did: space.did() };
    } catch (error) {
        console.error("Error creating new Storacha space:", error);
        return { success: false, did: null };
    }
}

export async function uploadToStoracha(fileBuffer, fileName) {
    try {
        const { client, account } = await initializeClient();
        await waitForPlanActivation(account);

        console.log("Fetching user's current space...");
        const res = await account.agent.getSpaceInfo();
        if (!res || !res.did) {
            throw new Error("No space found! Please provide a space name to create a new one.");
        }

        const space = res;
        await client.setCurrentSpace(space.did);
        console.log("Using existing space:", space.did);

        const file = new File([fileBuffer], fileName);
        console.log("Uploading file:", fileName);
        const cid = await client.uploadFile(file);
        console.log("File uploaded successfully, CID:", cid);

        return { success: true, url: `https://${cid}.ipfs.w3s.link` };
    } catch (error) {
        console.error("Error uploading file to Storacha:", error);
        return { success: false, url: null };
    }
}

export async function getAllUploadedFiles() {
  try {
      const { client, account } = await initializeClient();
      await waitForPlanActivation(account);

      const list = await client.capability.upload.list({ cursor: '', size: 25 });
      console.log('List of uploaded files:', list);

      return { success: true, files: list };
  } catch (error) {
      console.error("Error fetching uploaded files from Storacha:", error);
      return { success: false, files: null };
  }
}

export async function setCurrentSpaceByDID(did) {
  try {
      const {account, client } = await initializeClient();
      const res = await account.agent.getSpaceInfo();
      console.log("Current Space :", res.did);
      await client.setCurrentSpace(did);
      console.log("Current space set to:", did);
      return { success: true };
  } catch (error) {
      console.error("Error setting current space by DID:", error);
      return { success: false };
  }
}