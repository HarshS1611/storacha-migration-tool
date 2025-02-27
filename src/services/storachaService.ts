import { create } from "@web3-storage/w3up-client";
import type { Client } from "@web3-storage/w3up-client";
import {
  UploadResponse,
  SpaceResponse,
} from "../types/index.js";
import dotenv from "dotenv";
dotenv.config();

interface StorachaClient extends Omit<Client, "login"> {
  login: (email: `${string}@${string}`) => Promise<any>;
  uploadDirectory: (files: File[]) => Promise<any>;
}

interface StorachaAccount {
  plan: {
    wait: () => Promise<any>;
  };
  agent: {
    getSpaceInfo: () => Promise<{ did: string }>;
  };
}

interface Space {
  did: () => string;
}

function validateEmail(email: string): `${string}@${string}` {
  if (!email || !email.includes("@")) {
    throw new Error(
      "Invalid email format. Email must be in the format user@domain"
    );
  }
  return email as `${string}@${string}`;
}

async function initializeClient(): Promise<{
  client: StorachaClient;
  account: StorachaAccount;
}> {
  try {
    console.log("🛠 Initializing Storacha client...");
    const client = await create();
    console.log("🔑 Logging in to Storacha...");
    const email = process.env.STORACHA_EMAIL;
    if (!email) {
      throw new Error("STORACHA_EMAIL environment variable is not set");
    }
    const validEmail = validateEmail(email);
    const account = await client.login(validEmail);
    console.log(`✅ Logged into Storacha with email: ${email}`);
    return {
      client: client as StorachaClient,
      account: account as StorachaAccount,
    };
  } catch (error) {
    console.error("❌ Error initializing client:", error);
    throw error;
  }
}

async function waitForPlanActivation(account: StorachaAccount): Promise<void> {
  try {
    console.log("⏳ Waiting for payment plan activation...");
    await account.plan.wait();
    console.log("✅ Payment plan confirmed.");
  } catch (error) {
    console.error("❌ Error waiting for plan activation:", error);
    throw error;
  }
}

export async function uploadToStoracha(
  fileBuffer: Buffer,
  fileName: string
): Promise<UploadResponse> {
  try {
    const { client, account } = await initializeClient();
    await waitForPlanActivation(account);

    console.log("🔍 Fetching user's current space...");
    const res = await account.agent.getSpaceInfo();
    if (!res || !res.did) {
      throw new Error("❌ No space found! Please create a new space first.");
    }

    const space = res;
    await client.setCurrentSpace(space.did as any);
    console.log(`✅ Using existing space: ${space.did}`);

    const file = new File([fileBuffer], fileName);
    console.log(`📤 Uploading file: ${fileName}...`);
    const cid = await client.uploadFile(file);
    console.log(`✅ File uploaded successfully! CID: ${cid.toString()}`);

    return { success: true, url: `https://${cid.toString()}.ipfs.w3s.link` };
  } catch (error) {
    console.error("❌ Error uploading file to Storacha:", error);
    return { success: false, url: undefined };
  }
}

export async function uploadDirectoryToStoracha(
  filesArray: { buffer: Buffer; fileName: string }[]
): Promise<UploadResponse> {
  try {
    const { client, account } = await initializeClient();
    await waitForPlanActivation(account);

    console.log("🔍 Fetching user's current space...");
    const res = await account.agent.getSpaceInfo();
    if (!res || !res.did) {
      throw new Error("❌ No space found! Please create a new space first.");
    }

    const space = res;
    await client.setCurrentSpace(space.did as any);
    console.log(`✅ Using existing space: ${space.did}`);

    const files = filesArray.map(
      ({ buffer, fileName }) => new File([buffer], fileName)
    );

    console.log(`📂 Uploading ${files.length} files as a directory...`);
    const directoryCid = await client.uploadDirectory(files);
    console.log(`✅ Directory uploaded successfully! CID: ${directoryCid}`);

    return { success: true, url: `https://${directoryCid}.ipfs.w3s.link` };
  } catch (error) {
    console.error("❌ Error uploading directory to Storacha:", error);
    return { success: false, url: undefined };
  }
}

export async function createNewStorachaSpace(
  spaceName: string
): Promise<SpaceResponse> {
  try {
    console.log(`🚀 Creating new Storacha space: ${spaceName}...`);
    const { client, account } = await initializeClient();
    await waitForPlanActivation(account);

    const space = (await client.createSpace(spaceName, {account} as any)) as Space;
    await client.setCurrentSpace(space.did() as any);
    console.log(
      `✅ New space created and set as current: ${spaceName} (DID: ${space.did()})`
    );
    return { success: true, did: space.did() };
  } catch (error) {
    console.error("❌ Error creating new Storacha space:", error);
    return { success: false, did: undefined, error: String(error) };
  }
}

export async function setCurrentSpaceByDID(
  did: string
): Promise<SpaceResponse> {
  try {
    console.log(`🔄 Setting current space to DID: ${did}...`);
    const { account, client } = await initializeClient();
    const res = await account.agent.getSpaceInfo();
    console.log(`📍 Current Space: ${res.did}`);
    await client.setCurrentSpace(did as any);
    console.log(`✅ Successfully set current space to: ${did}`);
    return { success: true, did };
  } catch (error) {
    console.error("❌ Error setting current space by DID:", error);
    return { success: false, did: undefined, error: String(error) };
  }
}
