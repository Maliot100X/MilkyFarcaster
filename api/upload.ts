import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { filename, fileContent, contentType } = request.body;
  const pinataJwt = process.env.PINATA_JWT;

  if (!pinataJwt) {
    return response.status(503).json({ error: 'Pinata configuration missing' });
  }

  if (!filename || !fileContent || !contentType) {
    return response.status(400).json({ error: 'Missing file data' });
  }

  try {
    // We expect fileContent to be base64 encoded
    const buffer = Buffer.from(fileContent, 'base64');
    const blob = new Blob([buffer], { type: contentType });
    
    const formData = new FormData();
    formData.append('file', blob, filename);
    
    const pinataMetadata = JSON.stringify({
      name: filename,
      keyvalues: {
        app: 'MilkyFarcaster'
      }
    });
    formData.append('pinataMetadata', pinataMetadata);

    const pinataOptions = JSON.stringify({
      cidVersion: 1,
    });
    formData.append('pinataOptions', pinataOptions);

    const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pinataJwt}`
      },
      body: formData
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Pinata upload failed: ${errorText}`);
    }

    const data = await res.json();
    return response.status(200).json({ 
      ipfsHash: data.IpfsHash,
      url: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
    });

  } catch (error) {
    console.error('Upload Error:', error);
    return response.status(500).json({ error: 'Failed to upload file' });
  }
}
