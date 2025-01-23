const { google } = require('googleapis');
const fileHandler = require('./fileHandler');


const LAST_EMAIL_ID_FILE = 'lastEmailId.txt'; // File to store the last processed email ID
const LAST_EMAIL_TIME_FILE = 'lastEmailTime.txt'; // File to store the last processed email time


async function fetchEmails(auth) {

  try {
    const gmail = google.gmail({ version: 'v1', auth });

    let lastEmailId = await fileHandler.readFile(LAST_EMAIL_ID_FILE);

    let lastEmailTime = await fileHandler.readFile(LAST_EMAIL_TIME_FILE);

    console.log(`Last processed email time: ${lastEmailTime}`);
    console.log(`Last processed email ID: ${lastEmailId}`);

    // Search for emails starting from the last email ID
    const query = lastEmailId === '0'
      ? `has:attachment filename:pdf after:${lastEmailTime}` // First run: Fetch emails from a specific date
      : `has:attachment filename:pdf newer_than:${lastEmailId}`; // Subsequent runs: Fetch newer emails

    // Search for emails with attachments (you can customize the query)
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query, // Query to find emails with PDF attachments
    });

    const messages = res.data.messages || [];
    // console.log(res.data)
    console.log(`Found ${messages.length} emails with attachments.`);

    // let latestEmailId = null; // To track the latest email ID processed

    // for (const message of messages) {
    //   const msg = await gmail.users.messages.get({
    //     userId: 'me',
    //     id: message.id,
    //   });

    //   // console.log('...', msg.data)

    //   const parts = msg.data.payload.parts || [];
    //   for (const part of parts) {
    //     if (part.filename && part.body.attachmentId) {
    //       const attachment = await gmail.users.messages.attachments.get({
    //         userId: 'me',
    //         messageId: message.id,
    //         id: part.body.attachmentId,
    //       });

    //       const data = attachment.data.data;
    //       const buffer = Buffer.from(data, 'base64');

    //       // Save the PDF attachment
    //       const filePath = path.join(downloadDir, part.filename);
    //       fs.writeFileSync(filePath, buffer);
    //       console.log(`Attachment saved: ${filePath}`);
    //     }
    //   }

    //   latestEmailId = message.id; // Update the latest email ID processed
    // }

    // if (latestEmailId) {
    //   fs.writeFileSync(LAST_EMAIL_ID_FILE, latestEmailId, 'utf8');
    //   console.log(`Updated last email ID to: ${latestEmailId}`);
    // } else {
    //   console.log('No new emails were processed.');
    // }

    return messages

  } catch (error) {
    console.log('Error while fetching emails:', error);
    return [];
  }


}

module.exports = { fetchEmails };
