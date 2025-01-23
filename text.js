async function processEmails() {
  try {
    // Authenticate with Gmail API
    const auth = await authorize(false);

    // Fetch emails with attachments
    const messages = await fetchEmails(auth);
    const gmail = google.gmail({ version: 'v1', auth });

    let latestEmailId = null; // To track the latest email ID processed

    for (const message of messages) {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
      });

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

          // Extract data from the PDF
          const extractedData = await extractDataFromPDF(buffer);

          console.log(`Extracted Data from ${part.filename}:\n`, extractedData);

          // Validate and save extracted data
          for (let i = 0; i < extractedData.length; i++) {
            const check_validation = validation(extractedData[i]);
            if (check_validation) {
              await insertSeedData(extractedData[i]);
              console.log(`Inserted Data to Database:\n`, message.id, ' ', i, ' Page');
            } else {
              allValid = false;
              invalidPages.push(i + 1); // Track the invalid page number
              console.log(`Validation failed for page ${i + 1} of ${part.filename}`);
            }
          }
        }
      }

      // Compose and send email to the sender
      if (allValid) {
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
            <p>The following pages did not pass validation:</p>
            <ul>
              ${invalidPages.map((page) => `<li>Page ${page}</li>`).join('')}
            </ul>
            <p>Please review and try again.</p>
          `;
        await sendEmail(auth, senderEmail, subject, body);
      }

      latestEmailId = message.id; // Update the latest email ID processed
    }

    if (latestEmailId) {
      fs.writeFileSync(LAST_EMAIL_ID_FILE, latestEmailId, 'utf8');
      console.log(`Updated last email ID to: ${latestEmailId}`);
    } else {
      console.log('No new emails were processed.');
    }
  } catch (error) {
    console.error('Error processing emails:', error);
  }
}
