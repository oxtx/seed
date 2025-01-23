const fs = require('fs');
const pdfParse = require('pdf-parse');
const path = require('path');
const { extractNameVariety } = require('./extractNameVariety');
const { validation } = require('./utils');
const { insertSeedData } = require('./insertdb');
const { pool } = require('./dbconnect');


async function extractDataFromPDF(dataBuffer) {
  // const dataBuffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(dataBuffer);
  const text = data.text;
  // The delimiter string to split by
  const delimiter = "Peaceful Valley Farm Supply\n125 Clydesdale Court\nGrass Valley, CA 95945";
  const pages = text.split(delimiter);

  // console.log(pages, 'pages', pages.length);
  const datas = [];


  for (let i = 1; i < pages.length; i++) {

    const page = pages[i];
    const lines = page.trim().split("\n");
    // console.log(lines, 'lines', lines.length);
    // console.log('page', page);
    const title = lines[0];
    // Extract the percentage of "Other Crop" from the page.
    // Format: "<number> Other Crop", "<number>Other Crop", "<number> Other CropData..", or "<number>Other Crop asdfadf"
    // Number range: 0.00 to 99.99
    // Example: "0.00 Other Crop", "99.99Other Crop", "45.67 Other CropData", "0.00 Other Crop Date"
    const otherCropMatch = page.match(/((?:[0-9]|[1-9][0-9])(?:\.\d{1,2})?)\s*Other Crop/i);
    const otherCrop = otherCropMatch ? parseFloat(otherCropMatch[1]) : null;

    const inertMatterMatch = page.match(/((?:[0-9]|[1-9][0-9])(?:\.\d{1,2})?)\s*Inert Matter/i);
    const inertMatter = inertMatterMatch ? parseFloat(inertMatterMatch[1]) : null;

    const weedSeedMatch = page.match(/((?:[0-9]|[1-9][0-9])(?:\.\d{1,2})?)\s*Weed Seed/i);
    const weedSeed = weedSeedMatch ? parseFloat(weedSeedMatch[1]) : null;

    const dateTestedMatch = page.match(/Date Tested:\s*([\dA-Za-z-]+)/);
    const dateTested = dateTestedMatch ? dateTestedMatch[1] : null;

    const hardSeedMatch = page.match(/Hard Seed:\s*([\d.]+)/);
    const hardSeed = hardSeedMatch ? parseFloat(hardSeedMatch[1]) : null;

    const noxiousWeedMatch = page.match(/^Noxious Weed:\s*([\d.]+)?$/m);
    const Noxious = noxiousWeedMatch && noxiousWeedMatch[1] ? parseFloat(noxiousWeedMatch[1]) : 0;

    const coverageMatch = page.match(/Coverage:\s*([\d.x Bulk]+)/);
    const coverage = coverageMatch ? coverageMatch[1] : null;

    const weightMatch = page.match(/Weight:\s*([\d.]+ lbs \(PLS\)) \/ ([\d.]+ lbs \(Bulk\))/);
    const weight = weightMatch
      ? {
        PLS: weightMatch[1],
        Bulk: weightMatch[2]
      }
      : null;

    const lotMatch = page.match(/Lot\s*#([A-Za-z0-9-]+)/);
    const lot = lotMatch ? lotMatch[0] : null;
    const orderMatch = page.match(/Order\s*#([A-Za-z0-9-]+)/);
    const order = orderMatch ? orderMatch[0] : null;
    const mixMatch = page.match(/Mix\s*#([A-Za-z0-9-]+)/);
    const mix = mixMatch ? mixMatch[0] : null;

    const tableStartIndex = lines.findIndex(line => line.includes("% Pure")); // Locate the start of the table
    const tableEndIndex = lines.findIndex(line => line.includes("Other Crop")); // Locate the end of the table
    const tableLines = lines.slice(tableStartIndex + 1, tableEndIndex);

    const tableData = tableLines.map(line => {
      // console.log("line", line);
      // 1. Extract percentage_pure
      const percentageMatch = line.match(/^(\d+\.\d+)/);
      if (!percentageMatch) return null; // Invalid format
      const percentage_pure = parseFloat(percentageMatch[1]);

      // 2. Extract origin (last two or more uppercase letters)
      const originMatch = line.match(/([A-Z]{2,})$/);
      if (!originMatch) return null; // Invalid format
      const origin = originMatch[1];

      // 3. Extract G_D_or_H (number + number = number) or number - TZ
      const gdhMatch = line.match(/(\d+\s*\+\s*\d+\s*=\s*\d+|\d+\s*-\s*TZ)/);
      if (!gdhMatch) return null; // Invalid format
      const G_D_or_H = gdhMatch[1].replace(/\s+/g, ' ').trim();

      // 4. Extract the substring containing Name and Variety
      const startIndex = percentageMatch[0].length;
      const endIndex = gdhMatch.index;
      const nameVariety = line.slice(startIndex, endIndex).trim();
      // console.log('namevariety', nameVariety)
      const [name, variety] = extractNameVariety(nameVariety);
      // console.log(name, variety, 'name, variety');
      const table_data = {
        percentage_pure,
        name,
        variety,
        G_D_or_H,
        origin
      };

      // console.log(table_data, 'table_data');
      return table_data;
    }).filter((data) => data != null);
    // console.log(tableData, 'tableData');

    datas.push({
      title: title.trim(),
      table: tableData,
      Other_Crop: otherCrop,
      Inert_Matter: inertMatter,
      Weed_Seed: weedSeed,
      date_tested: dateTested.trim(),
      Hard_Seed: hardSeed,
      Coverage: coverage.trim(),
      Weight: weight,
      Noxious: Noxious,
      Lot: lot != null ? lot.split("Lot ")[1].replace("#", "").trim() : null,
      Order: order != null ? order.split("Order ")[1].replace("#", "").trim() : null,
      Mix: mix != null ? mix.split("Mix ")[1].replace("#", "").trim() : null,
    });

  }

  // console.log(datas, 'datas');
  return datas;

};



// const downloadDir = path.join(__dirname, 'downloads');

// const pdfPath1 = path.join(downloadDir, 'mixes.pdf');
// const pdfPath2 = path.join(downloadDir, 'orders.pdf');
// const pdfPath3 = path.join(downloadDir, 'Order.pdf');


// extractDataFromPDF(pdfPath2).then((data) => {
//   // console.log(data, 'data');
//   for (let i = 0; i < data.length; i++) {
//     const check_validation = validation(data[i]);
//     console.log(check_validation, i);
//     if (check_validation) {
//       insertSeedData(data[i]);

//     }
//     // End the pool when your application is shutting down
//     // insertSeedData(data[0]);
//   }

// })
// extractDataFromPDF(pdfPath2).then((data) => {
//   console.log(data, 'data');
// })
// extractDataFromPDF(pdfPath3).then((data) => {
//   console.log(data, 'data');
// })

module.exports = { extractDataFromPDF };
