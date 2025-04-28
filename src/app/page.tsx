"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, FileText, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

// TypeScript interfaces for different document types
interface BaseDocument {
  filename: string;
  type: string;
}

interface CompanyRegistrationDocument extends BaseDocument {
  company_name?: string;
  registration_number?: string;
  incorporation_date?: string;
}

interface CertificateOfGoodStandingDocument extends BaseDocument {
  company_name?: string;
  registration_number?: string;
  issued_date?: string;
  issuing_authority?: string;
  expiration_date?: string;
  compliance_status?: Record<string, any>;
  red_flags?: any[];
}

interface RegistrationNumberInfoDocument extends BaseDocument {
  registration_number?: any[];
  issuing_authority?: string[];
  compliance_status?: Record<string, any>;
  red_flags?: any[];
}

interface CompanyArticlesDocument extends BaseDocument {
  "Company Purpose and Activities"?: string;
  "Governance Structure"?: string;
  "Share Capital Information"?: Record<string, any>;
  "Board Composition Rules"?: string;
  "Amendment History"?: string;
}

// Union type for all document types
type Document = 
  | CompanyRegistrationDocument 
  | CertificateOfGoodStandingDocument 
  | RegistrationNumberInfoDocument
  | CompanyArticlesDocument;

interface VerificationSummary {
  identityVerified: boolean;
  riskScore: string;
  recommendedAction: string;
}

interface ExtractedData {
  documents: Document[];
  verificationSummary: VerificationSummary;
}

export default function DocumentUploadApp() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  // Handle file selection via input element
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      // Add new files to existing files
      const newFiles = Array.from(e.target.files);
      addFiles(newFiles);
    }
  };

  // Handle files from both drag-and-drop and file input
  const addFiles = (newFiles: File[]) => {
    // Check for duplicates by filename
    const currentFilenames = files.map(f => f.name);
    const uniqueNewFiles = newFiles.filter(file => !currentFilenames.includes(file.name));
    
    // Filter for only PDF files based on your backend requirement
    const pdfFiles = uniqueNewFiles.filter(file => file.name.toLowerCase().endsWith('.pdf'));
    
    if (pdfFiles.length < uniqueNewFiles.length) {
      setError("Only PDF files are supported. Some files were filtered out.");
    }
    
    setFiles(prevFiles => [...prevFiles, ...pdfFiles]);

    // Clear the file input so the same file can be added again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files?.length) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
    }
  };

  // Upload a single file to the server
  const uploadSingleFile = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('http://127.0.0.1:5000/upload', {
        method: 'POST',
        body: formData,
      });
      
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Failed to upload ${file.name}: ${response.statusText}`);
      }
      
      // Wait for the complete response and parse it
      const data = await response.json();
      console.log('Response data:', data);
      
      // Return the filename with spaces removed
      return file.name.replace(/\s+/g, '');
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  };

  // Handle file uploads one by one
  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select at least one PDF file to upload");
      return;
    }

    setError(null);
    setIsUploading(true);
    setProgress(0);
    setUploadedFiles([]);

    try {
      // Upload each file one by one
      const uploadedFileNames: string[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = await uploadSingleFile(file);
        uploadedFileNames.push(filename);
        
        // Update progress based on completed uploads
        const singleFileProgress = Math.floor((i + 1) / files.length * 50); // First 50% for uploads
        setProgress(singleFileProgress);
      }
      
      setIsUploading(false);
      setIsProcessing(true);
      setUploadedFiles(uploadedFileNames);
      
      // Now process the uploaded documents
      const startProcessing = 50; // Start from 50% after upload is complete
      const processInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 95) {
            clearInterval(processInterval);
            return prev;
          }
          return prev + 5;
        });
      }, 500);
      
      // Call the process_docs endpoint with the list of uploaded files
      const processResponse = await fetch('http://127.0.0.1:5000/process_docs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          list_of_doc: uploadedFileNames,
        }),
      });
      
      if (!processResponse.ok) {
        throw new Error(`Processing failed: ${processResponse.statusText}`);
      }
      
      // Get the processing result
      const processResult = await processResponse.json();
      
      // When processing is complete
      clearInterval(processInterval);
      setProgress(100);
      setIsProcessing(false);
      
      // Parse the JSON strings in the data array
      const parsedDocuments = processResult.data.map((jsonString: string, index: number) => {
        try {
          // Some JSON strings might be incomplete or malformed
          const cleanedJsonString = jsonString.replace(/\n/g, '').trim();
          
          // Try to fix incomplete JSON by adding closing braces if needed
          let fixedJsonString = cleanedJsonString;
          const openBraces = (fixedJsonString.match(/{/g) || []).length;
          const closeBraces = (fixedJsonString.match(/}/g) || []).length;
          if (openBraces > closeBraces) {
            fixedJsonString += '}'.repeat(openBraces - closeBraces);
          }
          
          let parsedData;
          try {
            parsedData = JSON.parse(fixedJsonString);
          } catch (e) {
            console.error("Failed to parse JSON:", fixedJsonString);
            // Create a partial object with any data we can extract
            parsedData = {
              raw_data: cleanedJsonString
            };
          }
          
          // Determine the document type and create structured data
          const doc: Document = {
            filename: files[index]?.name || `Document ${index + 1}`,
            type: "PDF",
            ...parsedData
          };
          
          return doc;
        } catch (error) {
          console.error("Error parsing document data:", error);
          return {
            filename: files[index]?.name || `Document ${index + 1}`,
            type: "PDF",
            error: "Failed to parse document data"
          };
        }
      });
      
      // Create verification summary based on document analysis
      const hasRedFlags = parsedDocuments.some(doc => 
        Array.isArray((doc as any).red_flags) && (doc as any).red_flags.length > 0
      );
      
      const formattedData: ExtractedData = {
        documents: parsedDocuments,
        verificationSummary: {
          identityVerified: !hasRedFlags,
          riskScore: hasRedFlags ? "Medium" : "Low",
          recommendedAction: hasRedFlags ? "Review" : "Approve",
        }
      };
      
      setExtractedData(formattedData);
      
    } catch (err) {
      console.error("Upload or processing error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload or process files. Please try again.");
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  // Remove a single file from the selection
  const handleRemoveFile = (indexToRemove: number) => {
    setFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  // Reset everything to upload more files
  const handleReset = () => {
    setFiles([]);
    setExtractedData(null);
    setProgress(0);
    setError(null);
    setUploadedFiles([]);
  };

  // Generate KYC report
  const handleGenerateReport = () => {
    alert("KYC Report generated and ready for download!");
  };

  // Helper function to render document information based on its type
  const renderDocumentInfo = (doc: Document) => {
    // Check for company registration document
    if ('company_name' in doc && 'registration_number' in doc && 'incorporation_date' in doc) {
      return (
        <>
          <div className="flex"><span className="font-medium text-gray-600 w-36">Company Name: </span><span className="text-gray-800">{doc.company_name}</span></div>
          <div className="flex"><span className="font-medium text-gray-600 w-36">Registration #: </span><span className="text-gray-800">{doc.registration_number}</span></div>
          <div className="flex"><span className="font-medium text-gray-600 w-36">Incorporated: </span><span className="text-gray-800">{doc.incorporation_date}</span></div>
        </>
      );
    }
    
    // Check for certificate of good standing
    if ('issuing_authority' in doc && 'compliance_status' in doc && typeof doc.compliance_status === 'object') {
      return (
        <>
          <div className="flex"><span className="font-medium text-gray-600 w-36">Company Name: </span><span className="text-gray-800">{doc.company_name}</span></div>
          <div className="flex"><span className="font-medium text-gray-600 w-36">Registration #: </span><span className="text-gray-800">{doc.registration_number}</span></div>
          <div className="flex"><span className="font-medium text-gray-600 w-36">Issued Date: </span><span className="text-gray-800">{doc.issued_date}</span></div>
          <div className="flex"><span className="font-medium text-gray-600 w-36">Expires: </span><span className="text-gray-800">{doc.expiration_date}</span></div>
          <div className="flex"><span className="font-medium text-gray-600 w-36">Authority: </span><span className="text-gray-800">{doc.issuing_authority}</span></div>
          <div className="flex mt-2"><span className="font-medium text-gray-600 w-36">Compliance: </span>
            <div className="flex flex-col text-gray-800">
              {doc.compliance_status && Object.entries(doc.compliance_status).map(([key, value]) => (
                <span key={key} className="text-sm mb-1">
                  <span className="font-medium">{key.replace(/_/g, ' ')}</span>: {String(value)}
                </span>
              ))}
            </div>
          </div>
          {Array.isArray(doc.red_flags) && doc.red_flags.length > 0 && (
            <div className="flex mt-2">
              <span className="font-medium text-red-600 w-36">Red Flags: </span>
              <div className="flex flex-col text-red-600">
                {doc.red_flags.map((flag, i) => (
                  <span key={i} className="text-sm mb-1">
                    {typeof flag === 'object' && flag.description ? flag.description : String(flag)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      );
    }
    
    // Check for registration number info
    if ('registration_number' in doc && Array.isArray(doc.registration_number)) {
      return (
        <>
          <div className="flex"><span className="font-medium text-gray-600 w-36">Reg. Number Types: </span>
            <div className="flex flex-col text-gray-800">
              {doc.registration_number.map((reg, i) => (
                <span key={i} className="text-sm mb-1">
                  {reg.type}: {reg.description} ({reg.format})
                </span>
              ))}
            </div>
          </div>
          
          {Array.isArray(doc.issuing_authority) && (
            <div className="flex mt-2">
              <span className="font-medium text-gray-600 w-36">Authorities: </span>
              <div className="flex flex-col text-gray-800">
                {doc.issuing_authority.map((auth, i) => (
                  <span key={i} className="text-sm mb-1">{auth}</span>
                ))}
              </div>
            </div>
          )}
          
          {Array.isArray(doc.red_flags) && doc.red_flags.length > 0 && (
            <div className="flex mt-2">
              <span className="font-medium text-red-600 w-36">Red Flags: </span>
              <div className="flex flex-col text-red-600">
                {doc.red_flags.map((flag, i) => (
                  <span key={i} className="text-sm mb-1">
                    {typeof flag === 'object' && flag.description ? flag.description : String(flag)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      );
    }
    
    // Check for company articles
    if ('Company Purpose and Activities' in doc || 'Share Capital Information' in doc) {
      return (
        <>
          {doc['Company Purpose and Activities'] && (
            <div className="flex"><span className="font-medium text-gray-600 w-36">Company Purpose: </span>
              <span className="text-gray-800">{doc['Company Purpose and Activities']}</span>
            </div>
          )}
          
          {doc['Governance Structure'] && (
            <div className="flex"><span className="font-medium text-gray-600 w-36">Governance: </span>
              <span className="text-gray-800">{doc['Governance Structure']}</span>
            </div>
          )}
          
          {doc['Share Capital Information'] && (
            <div className="flex mt-2"><span className="font-medium text-gray-600 w-36">Share Capital: </span>
              <div className="flex flex-col text-gray-800">
                {Object.entries(doc['Share Capital Information']).map(([key, value]) => (
                  <span key={key} className="text-sm mb-1">
                    <span className="font-medium">{key}:</span> {
                      typeof value === 'object' 
                        ? JSON.stringify(value).substring(0, 100) + '...' 
                        : String(value)
                    }
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {doc['Amendment History'] && (
            <div className="flex"><span className="font-medium text-gray-600 w-36">History: </span>
              <span className="text-gray-800">{doc['Amendment History']}</span>
            </div>
          )}
        </>
      );
    }
    
    // Fallback for other document types or malformed data
    return (
      <div className="space-y-2">
        {Object.entries(doc).map(([key, value]) => {
          // Skip filename and type as they're already displayed in the header
          if (key === 'filename' || key === 'type') return null;
          
          // Handle different value types
          if (typeof value === 'object' && value !== null) {
            return (
              <div key={key} className="flex">
                <span className="font-medium text-gray-600 w-36">{key}: </span>
                <span className="text-gray-800 text-sm italic">Complex data (expand for details)</span>
              </div>
            );
          } else {
            return (
              <div key={key} className="flex">
                <span className="font-medium text-gray-600 w-36">{key}: </span>
                <span className="text-gray-800">{String(value)}</span>
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold">
            Document Verification
          </CardTitle>
          <CardDescription className="text-blue-100">
            Upload your documents for KYC verification
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {!isUploading && !isProcessing && !extractedData && (
            <div className="space-y-6">
              <div
                className={`border-2 border-dashed ${
                  isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                } rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className={`mx-auto h-12 w-12 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
                <h3 className="mt-2 text-lg font-medium text-gray-900">
                  {isDragOver ? 'Drop Files Here' : 'Upload Documents'}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Drag and drop your files here or click to browse
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Supports PDF files only (Max 10MB each)
                </p>
                <input
                  ref={fileInputRef}
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  multiple
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {files.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-700 mb-2">
                    Selected Files: {files.length}
                  </h4>
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center p-2 bg-gray-50 rounded group"
                      >
                        <FileText className="h-5 w-5 text-blue-500 mr-2" />
                        <span className="text-sm text-gray-600 flex-1">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-500 mr-2">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(index);
                          }}
                          className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {(isUploading || isProcessing) && (
            <div className="py-12 space-y-6 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900">
                {isUploading
                  ? "Uploading your documents..."
                  : "Processing your documents..."}
              </h3>
              <div className="w-full max-w-md mx-auto">
                <Progress
                  value={progress}
                  className="h-2"
                />
                <p className="mt-2 text-sm text-gray-500">
                  {isUploading
                    ? `Uploading files: ${Math.min(progress * 2, 100)}%`
                    : `Analyzing documents: ${progress}%`}
                </p>
              </div>
            </div>
          )}

          {extractedData && (
            <div className="space-y-6">
              <div className="flex items-center space-x-2 text-green-600">
                <Check className="h-6 w-6" />
                <h3 className="text-lg font-medium">
                  Documents Processed Successfully
                </h3>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium text-gray-800">
                  Document Analysis:
                </h4>

                {extractedData.documents.map((doc, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-4">
                      <h5 className="font-medium">{doc.filename}</h5>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {doc.type}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3 text-sm">
                      {renderDocumentInfo(doc)}
                    </div>
                  </div>
                ))}

                <div className="bg-gray-50 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-gray-800 mb-3">
                    Verification Summary
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {Object.entries(extractedData.verificationSummary).map(
                      ([key, value]) => (
                        <div key={key} className="flex">
                          <span className="font-medium text-gray-600 w-36">
                            {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:{" "}
                          </span>
                          <span
                            className={`${
                              value === "Low" ||
                              value === true ||
                              value === "Approve"
                                ? "text-green-600"
                                : value === "Medium" || value === "Review"
                                ? "text-amber-600"
                                : value === "High" || value === "Reject"
                                ? "text-red-600"
                                : "text-gray-800"
                            } font-medium`}
                          >
                            {typeof value === "boolean"
                              ? value
                                ? "Yes"
                                : "No"
                              : value}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-between p-6 bg-gray-50 rounded-b-lg">
          {!extractedData ? (
            <>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={isUploading || isProcessing || files.length === 0}
              >
                Clear
              </Button>
              <Button
                onClick={handleUpload}
                disabled={isUploading || isProcessing || files.length === 0}
              >
                {isUploading || isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Process
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleReset}>
                Upload New Documents
              </Button>
              <Button
                onClick={handleGenerateReport}
                className="bg-green-600 hover:bg-green-700"
              >
                Generate KYC Report
              </Button>
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}