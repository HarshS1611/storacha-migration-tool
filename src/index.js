import { uploadToStoracha } from "./storachaService";


async function testUpload() {
    const fileBuffer = Buffer.from("Hello Storacha!");
    const fileName = "test-file.txt";
    
    console.log("Starting test upload...");
    const url = await uploadToStoracha(fileBuffer, fileName);
    console.log("Test upload complete. File URL:", url);
  }
  
  testUpload();
  