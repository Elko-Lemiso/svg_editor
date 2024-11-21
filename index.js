const fs = require('fs');
const axios = require('axios');
const { JSDOM } = require('jsdom');
const sharp = require('sharp'); // For SVG to PNG conversion
const PDFDocument = require('pdfkit'); // For creating PDF documents

// Paths
const inputSVGPath = 'auctionit.svg'; // Input SVG file
const outputSVGPath = 'auctionit_updated.svg'; // Output SVG file
const outputPNGPath = 'auctionit_updated.png'; // Output PNG file
const outputPDFPath = 'auctionit_updated.pdf'; // Output PDF file

const placeholders = {
  '$name': 'Sample Auction',
  '$client': 'Sample Auctioneer',
  '$date': '2024-12-01',
  '$time': '10:00 AM',
  '$venue_line1': '123 Auction Road',
  '$venue_line2': 'Auction City',
  '$venue_line3': 'Country',
  '$feature_line1': 'Feature 1',
  '$feature_line2': 'Feature 2',
  '$feature_line3': 'Feature 3',
  '$description': 'This is a sample description for the auction.',
  '$start_pricing': '100,000',
  '$start_bidding': '500,000',
};

// Image URL
const imageURL = 'https://auctionitstorage.blob.core.windows.net/images/1c7abf65-793c-41fe-8c3c-2e18a048a40c.jpg'; // Replace with your desired image URL

// Main function to process SVG
async function processSVG() {
  // Read the SVG file
  let data;
  try {
    data = fs.readFileSync(inputSVGPath, 'utf8');
  } catch (err) {
    console.error('Error reading SVG file:', err);
    return;
  }

  // Fetch the image data and convert to Base64
  let imageDataURI;
  try {
    const response = await axios.get(imageURL, { responseType: 'arraybuffer' });
    const contentType = response.headers['content-type'];
    const base64Data = Buffer.from(response.data, 'binary').toString('base64');
    imageDataURI = `data:${contentType};base64,${base64Data}`;
  } catch (error) {
    console.error('Error fetching image data:', error);
    return;
  }

  // Parse the SVG using JSDOM
  const dom = new JSDOM(data, { contentType: 'image/svg+xml' });
  const document = dom.window.document;

  // Replace placeholders in text elements without centering
  const textElements = document.querySelectorAll('text');
  textElements.forEach((textElement) => {
    // Remove centering attributes if previously set
    textElement.removeAttribute('text-anchor');
    textElement.removeAttribute('dominant-baseline');

    // Replace placeholders
    Object.keys(placeholders).forEach((placeholder) => {
      if (textElement.textContent.includes(placeholder)) {
        textElement.textContent = textElement.textContent.replace(placeholder, placeholders[placeholder]);
      }
    });
  });

  // Replace the red rectangle with an image
  const redRect = document.querySelector('rect#rect5'); // Targeting by ID
  if (redRect) {
    const x = redRect.getAttribute('x') || '0';
    const y = redRect.getAttribute('y') || '0';
    const width = redRect.getAttribute('width') || '100';
    const height = redRect.getAttribute('height') || '100';

    // Create an image element
    const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    image.setAttributeNS(null, 'x', x);
    image.setAttributeNS(null, 'y', y);
    image.setAttributeNS(null, 'width', width);
    image.setAttributeNS(null, 'height', height);

    // Set 'preserveAspectRatio' to 'xMidYMid slice' to cover the entire rectangle without stretching
    image.setAttribute('preserveAspectRatio', 'xMidYMid slice');

    // Set the 'href' attribute to the data URI
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', imageDataURI);
    image.setAttributeNS(null, 'href', imageDataURI);

    // Replace the rectangle with the image
    redRect.parentNode.replaceChild(image, redRect);
  }

  // Save the updated SVG
  const updatedSVG = document.documentElement.outerHTML;
  fs.writeFileSync(outputSVGPath, updatedSVG);
  console.log(`Updated SVG saved as ${outputSVGPath}`);

  // Convert SVG to PNG
  let pngBuffer;
  try {
    pngBuffer = await sharp(Buffer.from(updatedSVG))
      .png()
      .toBuffer();
    fs.writeFileSync(outputPNGPath, pngBuffer);
    console.log(`PNG image saved as ${outputPNGPath}`);
  } catch (err) {
    console.error('Error converting SVG to PNG:', err);
  }

  // Convert SVG to PDF
  try {
    // Create a PDF document
    const pdfDoc = new PDFDocument({
      size: 'A4', // Use standard A4 size
      margin: 0,
    });
    const writeStream = fs.createWriteStream(outputPDFPath);
    pdfDoc.pipe(writeStream);

    // Get the dimensions of the PNG image
    const metadata = await sharp(pngBuffer).metadata();
    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    // Calculate scale factors to fit the image within the PDF page
    const pdfWidth = pdfDoc.page.width;
    const pdfHeight = pdfDoc.page.height;

    const widthScale = pdfWidth / imgWidth;
    const heightScale = pdfHeight / imgHeight;
    const scale = Math.min(widthScale, heightScale);

    const scaledWidth = imgWidth * scale;
    const scaledHeight = imgHeight * scale;

    // Center the image in the PDF
    const xPosition = (pdfWidth - scaledWidth) / 2;
    const yPosition = (pdfHeight - scaledHeight) / 2;

    // Add the image to the PDF
    pdfDoc.image(pngBuffer, xPosition, yPosition, {
      width: scaledWidth,
      height: scaledHeight,
    });
    pdfDoc.end();

    // Wait for the PDF to be written
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    console.log(`PDF document saved as ${outputPDFPath}`);
  } catch (err) {
    console.error('Error converting SVG to PDF:', err);
  }
}

// Run the main function
processSVG();
