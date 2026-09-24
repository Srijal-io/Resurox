import test from 'node:test';
import assert from 'node:assert';
import { inspectDocumentBinary, inspectDocxZipEntries } from '../lib/security/upload';

test('SEC-05..SEC-08 & PT-C: Hardened Upload Validation & Malicious File Rejection', async (t) => {
  await t.test('SEC-05: Valid PDF header (%PDF-) is accepted', () => {
    const validPdfBuffer = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    const result = inspectDocumentBinary(validPdfBuffer);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.fileType, 'pdf');
  });

  await t.test('SEC-05: Non-PDF renamed to .pdf is rejected (Magic Bytes check)', () => {
    // Fake text file named resume.pdf
    const fakePdfBuffer = Buffer.from('Plain text content that is not a PDF at all');
    const result = inspectDocumentBinary(fakePdfBuffer);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.error?.includes('neither a valid PDF nor Word'));
  });

  await t.test('SEC-05: Legacy Word .doc format is rejected with clear instructions', () => {
    // OLE2 binary magic bytes: 0xD0 0xCF 0x11 0xE0
    const legacyDocBuffer = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0x00, 0x00, 0x00, 0x00]);
    const result = inspectDocumentBinary(legacyDocBuffer);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.error?.includes('Legacy binary Word (.doc)'));
  });

  await t.test('SEC-05: Password-protected or Encrypted PDF is rejected', () => {
    const encryptedPdfBuffer = Buffer.from('%PDF-1.6\n1 0 obj\n<< /Type /Catalog /Encrypt 2 0 R >>\nendobj\n%%EOF');
    const result = inspectDocumentBinary(encryptedPdfBuffer);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.error?.includes('Password-protected or encrypted'));
  });

  await t.test('SEC-06: Macro-enabled Word document (.docm / vbaProject.bin) is rejected', () => {
    // Construct a synthetic ZIP buffer containing a vbaProject.bin header
    const zipHeader = Buffer.alloc(60);
    zipHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    zipHeader.writeUInt32LE(100, 18); // compressed size
    zipHeader.writeUInt32LE(100, 22); // uncompressed size
    const filename = 'word/vbaProject.bin';
    zipHeader.writeUInt16LE(filename.length, 26);
    zipHeader.writeUInt16LE(0, 28);
    zipHeader.write(filename, 30, filename.length, 'utf8');

    const result = inspectDocxZipEntries(zipHeader);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.error?.includes('Macro-enabled Word documents'));
  });

  await t.test('SEC-06: DOCX with path traversal (../) in entry name is rejected', () => {
    const zipHeader = Buffer.alloc(60);
    zipHeader.writeUInt32LE(0x04034b50, 0); // PK\x03\x04
    zipHeader.writeUInt32LE(100, 18);
    zipHeader.writeUInt32LE(100, 22);
    const filename = '../../etc/passwd';
    zipHeader.writeUInt16LE(filename.length, 26);
    zipHeader.writeUInt16LE(0, 28);
    zipHeader.write(filename, 30, filename.length, 'utf8');

    const result = inspectDocxZipEntries(zipHeader);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.error?.includes('path traversal'));
  });

  await t.test('SEC-06: Programmatic Zip Bomb with extreme compression ratio is rejected', () => {
    const zipHeader = Buffer.alloc(60);
    zipHeader.writeUInt32LE(0x04034b50, 0);
    zipHeader.writeUInt32LE(10, 18); // 10 compressed bytes
    zipHeader.writeUInt32LE(10000000, 22); // 10MB uncompressed -> 1,000,000x ratio!
    const filename = 'word/document.xml';
    zipHeader.writeUInt16LE(filename.length, 26);
    zipHeader.writeUInt16LE(0, 28);
    zipHeader.write(filename, 30, filename.length, 'utf8');

    const result = inspectDocxZipEntries(zipHeader);
    assert.strictEqual(result.isValid, false);
    assert.ok(result.error?.includes('compression ratio') || result.error?.includes('zip bomb'));
  });
});
