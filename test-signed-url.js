
import { generateSignedUrl } from './config/cloudinary.js';

const testUrl = 'https://res.cloudinary.com/dcwxpgx97/raw/authenticated/s--fz4rDnY_--/v1765633158/lms-uploads/materials/1765633156402-810022692.pptx';

console.log('Testing URL:', testUrl);
const signedUrl = generateSignedUrl(testUrl, { type: 'material' });
console.log('Resulting Signed URL:', signedUrl);

if (signedUrl.includes('fl_attachment')) {
    console.log('SUCCESS: Attachment flag found!');
} else {
    console.log('FAILURE: Attachment flag MISSING!');
}
