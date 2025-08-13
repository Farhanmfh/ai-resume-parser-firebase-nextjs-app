import { getStorage, ref, getDownloadURL } from "firebase/storage";

const storage = getStorage();

// Get file download URL (for direct links, may have CORS issues)
const getFileUrl = async (filePath) => {
    try {
        const fileRef = ref(storage, filePath);
        const url = await getDownloadURL(fileRef);
        return url;
    } catch (error) {
        console.error("Error fetching file URL:", error);
        return null; 
    }
};

// Get file URL for PDF rendering (now just returns direct URL)
const getFileBlobUrl = async (filePath) => {
    try {
        console.log("getFileBlobUrl called with path:", filePath);
        
        // Return the direct URL for iframe display
        const url = await getFileUrl(filePath);
        if (url) {
            console.log("Returning direct URL:", url);
            return { directUrl: url };
        }
        
        console.log("Failed to get file URL");
        return null;
    } catch (error) {
        console.error("Error getting file URL:", error);
        return null;
    }
};

// Cleanup function (no longer needed for iframe)
const cleanupBlobUrl = (blobUrl) => {
    // No cleanup needed for iframe URLs
};

export { getFileUrl, getFileBlobUrl, cleanupBlobUrl };
export default getFileUrl;
