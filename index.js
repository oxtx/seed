const fs = require('fs');
const { Storage } = require('@google-cloud/storage'); // For Google Cloud Storage
const path = require('path');
const cron = require('node-cron');
const express = require('express');
const { google } = require('googleapis');
const dotenv = require('dotenv');
const cors = require('cors');

const { authorize, auth } = require('./auth');
const { fetchEmails } = require('./fetchEmails');
const { extractDataFromPDF } = require('./extractData');
const { insertSeedData } = require('./insertdb');
const { validation } = require('./utils');
const fileHandler = require('./fileHandler');

// Load environment variables from .env file
dotenv.config();

const app = express(); // Initialize Express app
app.use(cors());

const PORT = process.env.PORT || 3000; // Use the PORT environment variable

const LAST_EMAIL_ID_FILE = 'lastEmailId.txt'; // File to store the last processed email ID
const LAST_EMAIL_TIME_FILE = 'lastEmailTime.txt'; // File to store the last processed email time


// Middleware to validate the security token
function validateToken(req, res, next) {
  const token = req.query.token || req.headers['authorization'];
  if (!token || token !== process.env.SECURITY_TOKEN) {
    return res.status(403).send('Forbidden: Invalid or missing token');
  }
  next();
}

async function sendEmail(auth, to, subject, body) {
  const gmail = google.gmail({ version: 'v1', auth });

  const email = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    body,
  ].join('\n');

  const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  try {
    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedEmail,
      },
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
  }
}

// Function to process emails
async function processEmails() {

  try {
    // Authenticate with Gmail API
    const auth = await authorize(app);

    // Fetch emails with attachments
    const messages = await fetchEmails(auth);


    const gmail = google.gmail({ version: 'v1', auth });

    let latestEmailId = null; // To track the latest email ID processed

    for (const message of messages) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });

      // console.log('...', msg.data)

      // Extract the sender's email address
      const headers = msg.data.payload.headers;
      const fromHeader = headers.find((header) => header.name === 'From');
      const senderEmail = fromHeader ? fromHeader.value.match(/<(.+)>/)[1] : null;

      if (!senderEmail) {
        console.error('Sender email not found for message:', message.id);
        continue;
      }


      const parts = msg.data.payload.parts || [];
      let allFilesValid = true; // Track if all files are valid
      let validationResults = []; // Store validation results for all files

      for (const part of parts) {
        if (part.filename && part.body.attachmentId) {
          const attachment = await gmail.users.messages.attachments.get({
            userId: 'me',
            messageId: message.id,
            id: part.body.attachmentId,
          });

          const data = attachment.data.data;
          const buffer = Buffer.from(data, 'base64');

          // Save the PDF attachment
          // const filePath = path.join(downloadDir, part.filename);
          // fs.writeFileSync(filePath, buffer);
          // console.log(`Attachment saved: ${filePath}`);

          // Extract data from the PDF
          const extractedData = await extractDataFromPDF(buffer);

          // console.log(`Extracted Data from ${file}:\n`, extractedData);

          let fileValid = true; // Track if this file is valid
          let invalidPages = []; // Track invalid pages for this file

          // Save extracted data to a database or file
          for (let i = 0; i < extractedData.length; i++) {
            const check_validation = validation(extractedData[i]);
            if (check_validation) {
              await insertSeedData(extractedData[i]);
              console.log(`Inserted Data to Database: ${i + 1} of ${part.filename}`);
            } else {
              fileValid = false;
              allFilesValid = false;
              invalidPages.push(i + 1); // Track the invalid page number
              console.log(`Validation failed for page ${i + 1} of ${part.filename}`);
            }
          }

          // Store validation results for this file
          validationResults.push({
            filename: part.filename,
            valid: fileValid,
            invalidPages,
          });

        }
      }

      // Compose and send email to the sender
      if (allFilesValid) {
        const subject = 'Validation Successful';
        const body = `
          <p>Dear Sender,</p>
          <p>All PDF files attached to your email have passed validation successfully.</p>
          <p>Thank you!</p>
        `;
        await sendEmail(auth, senderEmail, subject, body);
      } else {
        const subject = 'Validation Failed';
        const body = `
          <p>Dear Sender,</p>
          <p>Some PDF files attached to your email failed validation.</p>
          <p>Details:</p>
          <ul>
            ${validationResults
            .map((result) => {
              if (result.valid) {
                return `<li><strong>${result.filename}</strong>: All pages passed validation.</li>`;
              } else {
                return `<li><strong>${result.filename}</strong>: Validation failed on pages ${result.invalidPages.join(
                  ', '
                )}.</li>`;
              }
            })
            .join('')}
          </ul>
          <p>Please review and try again.</p>
        `;
        await sendEmail(auth, senderEmail, subject, body);
      }

      latestEmailId = message.id; // Update the latest email ID processed
    }

    if (latestEmailId) {
      await fileHandler.writeFile(LAST_EMAIL_ID_FILE, latestEmailId);
      console.log(`Updated last email ID to: ${latestEmailId}`);
    } else {
      console.log('No new emails were processed.');
    }







    // // Process downloaded PDFs
    // const downloadDir = path.join(__dirname, 'downloads');
    // const files = fs.readdirSync(downloadDir);

    // for (const file of files) {
    //   if (file.endsWith('.pdf')) {
    //     const pdfPath = path.join(downloadDir, file);
    //     console.log(`Processing file: ${pdfPath}`);

    //     // Extract data from the PDF
    //     const extractedData = await extractDataFromPDF(pdfPath);

    //     console.log(`Extracted Data from ${file}:\n`, extractedData);

    //     // Save extracted data to a database or file
    //     for (let i = 0; i < extractedData.length; i++) {
    //       await insertSeedData(extractedData[i]);
    //       console.log(`Inserted Data to Database:\n`, pdfPath, ' ', i, ' Page');
    //     }

    //     fs.unlinkSync(pdfPath); // Deletes the file
    //     console.log(`Deleted processed file: ${pdfPath}`);
    //   }
    // }
  } catch (error) {
    console.error('Error processing emails:', error);
  }
}

// Schedule the script to run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Running email processing job...');
  await processEmails();
});

// Define a route to call processEmails when visiting localhost:3000/cronjob
app.get('/cronjob', validateToken, async (req, res) => {
  try {
    console.log('Received request to trigger email processing...');
    await processEmails();
    res.status(200).send('Email processing job triggered successfully!');
  } catch (error) {
    console.error('Error triggering email processing:', error);
    res.status(500).send('Failed to trigger email processing job.');
  }
});

// Define a route to call authorize(true)
app.get('/authorize', validateToken, async (req, res) => {
  try {
    console.log('Received request to authorize...');
    await auth(app);
    res.status(200).send('Authorization completed successfully!');
  } catch (error) {
    console.error('Error during authorization:', error);
    res.status(500).send('Authorization failed.');
  }
});

// Define a route to update lastEmailId.txt
app.get('/update/lastEmailId', validateToken, async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).send('Bad Request: Missing "id" query parameter');
  }

  try {
    // Write the new ID to the file
    await fileHandler.writeFile(LAST_EMAIL_ID_FILE, id);

    // Optionally, read back the file to confirm
    const currentId = await fileHandler.readFile(LAST_EMAIL_ID_FILE);

    console.log(`Updated last email ID to: ${currentId}`);
    res.status(200).send(`Last email ID updated to: ${currentId}`);
  } catch (error) {
    console.error('Error updating last email ID:', error);
    res.status(500).send('Failed to update last email ID.');
  }
});

// Define a route to update lastEmailTime.txt
app.get('/update/lastEmailTime', validateToken, async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).send('Bad Request: Missing "id" query parameter');
  }

  try {
    // Write the new ID to the file
    await fileHandler.writeFile(LAST_EMAIL_TIME_FILE, id);

    // Optionally, read back the file to confirm
    const currentId = await fileHandler.readFile(LAST_EMAIL_TIME_FILE);

    console.log(`Updated last email Time to: ${currentId}`);
    res.status(200).send(`Last email Time updated to: ${currentId}`);
  } catch (error) {
    console.error('Error updating last email time:', error);
    res.status(500).send('Failed to update last email time.');
  }
});

// Endpoint to fetch the last email's details
app.get('/last-email', validateToken, async (req, res) => {
  try {

    // Read the last email ID from the file
    const lastEmailId = await fileHandler.readFile(LAST_EMAIL_TIME_FILE);


    if (lastEmailId === '0') {
      return res.status(404).json({
        success: false,
        message: 'No last email ID found. No emails have been processed yet.',
      });
    }

    // Authenticate with Gmail API
    const auth = await authorize(false);
    const gmail = google.gmail({ version: 'v1', auth });

    // Fetch the email details using the last email ID
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: lastEmailId,
    });

    // Extract email details
    const headers = msg.data.payload.headers;
    const fromHeader = headers.find((header) => header.name === 'From');
    const subjectHeader = headers.find((header) => header.name === 'Subject');
    const senderEmail = fromHeader ? fromHeader.value : 'Unknown Sender';
    const subject = subjectHeader ? subjectHeader.value : 'No Subject';

    // Get the email body (simplified for demonstration)
    let emailBody = '';
    if (msg.data.payload.parts) {
      const part = msg.data.payload.parts.find((p) => p.mimeType === 'text/plain');
      if (part && part.body && part.body.data) {
        emailBody = Buffer.from(part.body.data, 'base64').toString('utf8');
      }
    }

    // Return the email details as a JSON response
    res.json({
      success: true,
      data: {
        id: lastEmailId,
        sender: senderEmail,
        subject,
        body: emailBody,
      },
    });
  } catch (error) {
    console.error('Error fetching last email:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while retrieving the last email.',
    });
  }
});


// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Run the script immediately when the app starts
// processEmails();
