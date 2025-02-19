import { create } from "@web3-storage/w3up-client";
import dotenv from "dotenv";
dotenv.config();

export async function uploadToStoracha(fileBuffer, fileName) {
    console.log("Initializing Storacha client...");
    const client = await create();
    const account = await client.login(process.env.STORACHA_EMAIL);
    await account.plan.wait();
    console.log("Logged into Storacha with email:", process.env.STORACHA_EMAIL);
  
    const space = await client.createSpace(process.env.STORACHA_SPACE_NAME,{account});
    await client.setCurrentSpace(space.did());
    console.log("Using space:", process.env.STORACHA_SPACE_NAME);
  
    const file = new File([fileBuffer], fileName);
    console.log("Uploading file:", fileName);
    const cid = await client.uploadFile(file);
    console.log("File uploaded successfully, CID:", cid);
  
    return `https://${cid}.ipfs.w3s.link`;
  }
  