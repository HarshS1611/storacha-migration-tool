import { createNewStorachaSpace, setCurrentSpaceByDID, uploadToStoracha } from "./storachaService.js";


async function testUpload() {
    const fileBuffer = Buffer.from("Hello Storacha 3!");
    const fileName = "test-file2.txt";
    
    console.log("Starting test upload...");
    const url = await uploadToStoracha(fileBuffer, fileName);
    console.log("Test upload complete. File URL:", url);
  }

  async function createSpace() {
    const spaceName = "test-space";
    
    console.log("Creating new Storacha space...");
    const res = await createNewStorachaSpace(spaceName);
    console.log("Space Created Successfully:", res);
  }

  async function setSpace() {
    const spaceName = "your_space_did_here";
    
    console.log("Setting new Storacha space...");
    const res = await setCurrentSpaceByDID(spaceName);
    console.log("Space Set Successfully:", res);
  }

  // Function calls for creating a new space, uploading a file, and setting a space

  // createSpace();
  // testUpload();
  // setSpace();
  