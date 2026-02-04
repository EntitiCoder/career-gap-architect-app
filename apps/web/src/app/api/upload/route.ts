import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';

// Configuration constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const SUPPORTED_TYPES = ['pdf', 'docx', 'doc', 'txt'];
const MIN_TEXT_LENGTH = 10;

/**
 * POST /api/upload
 * Extracts text from uploaded files (PDF, DOCX, TXT)
 * 
 * Request: multipart/form-data with 'file' field
 * Response: { ok: boolean, text?: string, fileName?: string, fileType?: string, length?: number, error?: string }
 * 
 * Supported file types: PDF, DOCX, DOC, TXT (max 10MB)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { ok: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file size to prevent abuse
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` },
        { status: 413 }
      );
    }

    // Validate and get file extension
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();

    if (!fileExtension || !SUPPORTED_TYPES.includes(fileExtension)) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unsupported file type: ${fileExtension}. Supported types: ${SUPPORTED_TYPES.join(', ').toUpperCase()}`
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'File is empty' },
        { status: 400 }
      );
    }

    let extractedText = '';

    try {
      // Extract text based on file type
      if (fileExtension === 'pdf') {
        // Use unpdf for PDF parsing - works reliably in Next.js server environment
        const { extractText } = await import('unpdf');
        const result = await extractText(new Uint8Array(buffer));
        // unpdf returns text as an array of strings (one per page)
        extractedText = Array.isArray(result.text)
          ? result.text.join('\n\n')
          : String(result.text || '');
      } else if (fileExtension === 'docx' || fileExtension === 'doc') {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value;
      } else if (fileExtension === 'txt') {
        extractedText = buffer.toString('utf-8');
      }

      // Clean up the extracted text
      extractedText = extractedText
        .replace(/\r\n/g, '\n') // Normalize line endings
        .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
        .trim();

      if (!extractedText || extractedText.length < MIN_TEXT_LENGTH) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Could not extract text from the file. The file might be empty or corrupted.'
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        text: extractedText,
        fileName: file.name,
        fileType: fileExtension,
        length: extractedText.length,
      });

    } catch (parseError) {
      return NextResponse.json(
        {
          ok: false,
          error: `Failed to parse ${fileExtension?.toUpperCase()} file. Please ensure the file is not corrupted.`
        },
        { status: 500 }
      );
    }

  } catch (error) {
    return NextResponse.json(
      { ok: false, error: 'Failed to process uploaded file' },
      { status: 500 }
    );
  }
}
