const fs = require('fs').promises; // For local file system
const { Storage } = require('@google-cloud/storage'); // For Google Cloud Storage
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Load environment variables
const BUCKET_NAME = process.env.BUCKET_NAME;

// Initialize Google Cloud Storage
const storage = new Storage();
const bucket = storage.bucket(BUCKET_NAME);

const isProduction = process.env.NODE_ENV === 'production';

const fileHandler = {
    async writeFile(fileName, content) {
        if (isProduction) {
            // Write to Google Cloud Storage
            const file = bucket.file(fileName);
            await file.save(content, {
                contentType: 'text/plain',
                resumable: false,
            });
            console.log('File written to Google Cloud Storage.');
        } else {
            // Write to local file system
            await fs.writeFile(`./${fileName}`, content, 'utf8');
            console.log('File written to local file system.');
        }
    },

    async readFile(fileName) {
        if (isProduction) {
            // Read from Google Cloud Storage
            const file = bucket.file(fileName);
            const [content] = await file.download();
            console.log('File read from Google Cloud Storage.');
            return content.toString();
        } else {
            // Read from local file system
            const content = await fs.readFile(`./${fileName}`, 'utf8');
            console.log('File read from local file system.');
            return content;
        }
    },

    async deleteFile(fileName) {
        if (isProduction) {
            // Delete from Google Cloud Storage
            const file = bucket.file(fileName);
            try {
                await file.delete();
                console.log('File deleted from Google Cloud Storage.');
            } catch (err) {
                console.error('Error deleting file from Google Cloud Storage:', err.message);
                throw err;
            }
        } else {
            // Delete from local file system
            try {
                await fs.unlink(`./${fileName}`);
                console.log('File deleted from local file system.');
            } catch (err) {
                console.error('Error deleting file from local file system:', err.message);
                throw err;
            }
        }
    },
};

module.exports = fileHandler;
