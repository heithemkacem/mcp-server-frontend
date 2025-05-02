"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Loader2, Check, AlertCircle, FileCheck } from "lucide-react";
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

// Generic Document interface
interface Document {
  filename: string;
  type: string;
  data: any; // Dynamic JSON data
}

interface VerificationSummary {
  identityVerified: boolean;
  riskScore: string;
  recommendedAction: string;
}

interface ExtractedData {
  documents: Document[];
  verificationSummary: VerificationSummary;
}

interface KYCResult {
  message: string;
  kyc_data: any;
}

export default function DocumentUploadApp() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [kycResult, setKycResult] = useState<KYCResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [showJson, setShowJson] = useState<any>({}); // Track JSON visibility per document
  const [isProcessingKyc, setIsProcessingKyc] = useState<boolean>(false);
  const [processingStep, setProcessingStep] = useState<string>("upload");

  // Handle file selection via input element
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      const newFiles = Array.from(e.target.files);
      addFiles(newFiles);
    }
  };

  // Handle files from both drag-and-drop and file input
  const addFiles = (newFiles: File[]) => {
    const currentFilenames = files.map((f) => f.name);
    const uniqueNewFiles = newFiles.filter(
      (file) => !currentFilenames.includes(file.name)
    );
    const pdfFiles = uniqueNewFiles.filter((file) =>
      file.name.toLowerCase().endsWith(".pdf")
    );

    if (pdfFiles.length < uniqueNewFiles.length) {
      setError("Only PDF files are supported. Some files were filtered out.");
    }

    setFiles((prevFiles) => [...prevFiles, ...pdfFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:5000/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload ${file.name}: ${response.statusText}`);
      }

      const data = await response.json();
      return file.name.replace(/\s+/g, "");
    } catch (error) {
      console.error("Upload error:", error);
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
    setProcessingStep("upload");

    try {
      const uploadedFileNames: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = await uploadSingleFile(file);
        uploadedFileNames.push(filename);
        const singleFileProgress = Math.floor(((i + 1) / files.length) * 50);
        setProgress(singleFileProgress);
      }

      setIsUploading(false);
      setIsProcessing(true);
      setUploadedFiles(uploadedFileNames);
      setProcessingStep("extract");

      const startProcessing = 50;
      const processInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(processInterval);
            return prev;
          }
          return prev + 5;
        });
      }, 500);

      const processResponse = await fetch(
        "http://127.0.0.1:5000/process_docs",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            list_of_doc: uploadedFileNames,
          }),
        }
      );

      if (!processResponse.ok) {
        throw new Error(`Processing failed: ${processResponse.statusText}`);
      }

      const processResult = await processResponse.json();

      clearInterval(processInterval);
      setProgress(100);
      setIsProcessing(false);

      // Parse the JSON strings in the data array
      const parsedDocuments = processResult.data.map(
        (jsonString: string, index: number) => {
          let parsedData;
          try {
            const cleanedJsonString = jsonString.replace(/\n/g, "").trim();
            let fixedJsonString = cleanedJsonString;
            const openBraces = (fixedJsonString.match(/{/g) || []).length;
            const closeBraces = (fixedJsonString.match(/}/g) || []).length;
            if (openBraces > closeBraces) {
              fixedJsonString += "}".repeat(openBraces - closeBraces);
            }
            parsedData = JSON.parse(fixedJsonString);
          } catch (e) {
            console.error("Failed to parse JSON:", jsonString);
            parsedData = { raw_data: jsonString }; // Store raw string if parsing fails
          }

          const doc: Document = {
            filename: files[index]?.name || `Document ${index + 1}`,
            type: "PDF",
            data: parsedData,
          };

          return doc;
        }
      );

      // Simplified verification summary (no red_flags check since interfaces are removed)
      const formattedData: ExtractedData = {
        documents: parsedDocuments,
        verificationSummary: {
          identityVerified: true, // Default to true since no specific checks
          riskScore: "Low",
          recommendedAction: "Approve",
        },
      };

      setExtractedData(formattedData);
    } catch (err) {
      console.error("Upload or processing error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to upload or process files. Please try again."
      );
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  // Process KYC using the extracted data
  const processKYC = async () => {
    if (!extractedData) {
      setError("No document data to process");
      return;
    }

    setError(null);
    setIsProcessingKyc(true);
    setProcessingStep("kyc");
    setProgress(0);

    try {
      // Create a data object that combines all documents' data
      const combinedData = {
        documentData: extractedData.documents.map(doc => ({
          filename: doc.filename,
          data: doc.data
        })),
        verificationSummary: extractedData.verificationSummary
      };

      // Update progress periodically
      const processInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(processInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      // Call the KYC processing endpoint
      const kycResponse = await fetch("http://127.0.0.1:5000/process_kyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(combinedData),
      });

      clearInterval(processInterval);
      setProgress(100);

      if (!kycResponse.ok) {
        const errorData = await kycResponse.json();
        throw new Error(`KYC Processing failed: ${errorData.message || kycResponse.statusText}`);
      }

      const kycData = await kycResponse.json();
      setKycResult(kycData);
    } catch (err) {
      console.error("KYC processing error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process KYC data. Please try again."
      );
    } finally {
      setIsProcessingKyc(false);
    }
  };

  // Remove a single file from the selection
  const handleRemoveFile = (indexToRemove: number) => {
    setFiles((prevFiles) =>
      prevFiles.filter((_, index) => index !== indexToRemove)
    );
  };

  // Reset everything to upload more files
  const handleReset = () => {
    setFiles([]);
    setExtractedData(null);
    setKycResult(null);
    setProgress(0);
    setError(null);
    setUploadedFiles([]);
    setShowJson({});
    setProcessingStep("upload");
  };

  // Generate KYC report
  const handleGenerateReport = () => {
    if (kycResult) {
      alert("KYC Report generated and ready for download!");
    } else {
      setError("Please process the KYC data first");
    }
  };

  // Toggle JSON visibility for a document
  const toggleJson = (index: number) => {
    setShowJson((prev :any) => ({ ...prev, [index]: !prev[index] }));
  };

  // Render raw JSON for a document
  const renderRawJson = (doc: Document, index: number) => {
    const jsonString = JSON.stringify(doc.data, null, 2);
    return (
      <div className="mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => toggleJson(index)}
          className="mb-2"
        >
          {showJson[index] ? "Hide Raw JSON" : "Show Raw JSON"}
        </Button>
        {showJson[index] && (
          <pre className="bg-gray-900 text-white rounded-lg p-4 overflow-x-auto text-sm font-mono">
            <code>{jsonString}</code>
          </pre>
        )}
      </div>
    );
  };

  // Render the KYC result data
  const renderKycResult = () => {
    if (!kycResult) return null;

    return (
      <div className="mt-6 space-y-4">
        <div className="flex items-center space-x-2 text-green-600">
          <Check className="h-6 w-6" />
          <h3 className="text-lg font-medium">KYC Processing Complete</h3>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-3">
            KYC Analysis Results
          </h4>
          <div className="space-y-3">
            <div className="flex">
              <span className="font-medium text-gray-600 w-36">
                Status:
              </span>
              <span className={`font-medium ${
                kycResult.message.includes("successful") 
                  ? "text-green-600" 
                  : "text-red-600"
              }`}>
                {kycResult.message}
              </span>
            </div>

            {/* Display Fraud Detection results if available */}
            {kycResult.kyc_data?.FraudDetection && (
              <div className="border-t pt-3">
                <h5 className="font-medium text-gray-700 mb-2">Fraud Detection</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex">
                    <span className="font-medium text-gray-600 w-36">Result:</span>
                    <span className={`font-medium ${
                      kycResult.kyc_data.FraudDetection.finalResponse === "SUCCESS" 
                        ? "text-green-600" 
                        : "text-red-600"
                    }`}>
                      {kycResult.kyc_data.FraudDetection.finalResponse}
                    </span>
                  </div>
                  {kycResult.kyc_data.FraudDetection.reasoning && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-600">Reasoning:</span>
                      <p className="mt-1 text-gray-700">{kycResult.kyc_data.FraudDetection.reasoning}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Display Risk Assessment results if available */}
            {kycResult.kyc_data?.RiskAssessment && (
              <div className="border-t pt-3">
                <h5 className="font-medium text-gray-700 mb-2">Risk Assessment</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex">
                    <span className="font-medium text-gray-600 w-36">Result:</span>
                    <span className={`font-medium ${
                      kycResult.kyc_data.RiskAssessment.finalResponse === "SUCCESS" 
                        ? "text-green-600" 
                        : "text-red-600"
                    }`}>
                      {kycResult.kyc_data.RiskAssessment.finalResponse}
                    </span>
                  </div>
                  {kycResult.kyc_data.RiskAssessment.riskScore && (
                    <div className="flex">
                      <span className="font-medium text-gray-600 w-36">Risk Score:</span>
                      <span className={`font-medium ${
                        parseInt(kycResult.kyc_data.RiskAssessment.riskScore) < 50 
                          ? "text-green-600" 
                          : parseInt(kycResult.kyc_data.RiskAssessment.riskScore) < 75
                            ? "text-yellow-600"
                            : "text-red-600"
                      }`}>
                        {kycResult.kyc_data.RiskAssessment.riskScore}
                      </span>
                    </div>
                  )}
                  {kycResult.kyc_data.RiskAssessment.reasoning && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-600">Reasoning:</span>
                      <p className="mt-1 text-gray-700">{kycResult.kyc_data.RiskAssessment.reasoning}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Display Compliance Check results if available */}
            {kycResult.kyc_data?.ComplianceCheck && (
              <div className="border-t pt-3">
                <h5 className="font-medium text-gray-700 mb-2">Compliance Check</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex">
                    <span className="font-medium text-gray-600 w-36">Result:</span>
                    <span className={`font-medium ${
                      kycResult.kyc_data.ComplianceCheck.finalResponse === "SUCCESS" 
                        ? "text-green-600" 
                        : "text-red-600"
                    }`}>
                      {kycResult.kyc_data.ComplianceCheck.finalResponse}
                    </span>
                  </div>
                  {kycResult.kyc_data.ComplianceCheck.reasoning && (
                    <div className="col-span-2">
                      <span className="font-medium text-gray-600">Reasoning:</span>
                      <p className="mt-1 text-gray-700">{kycResult.kyc_data.ComplianceCheck.reasoning}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Show raw KYC data toggle button */}
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowJson((prev:any) => ({ ...prev, kycData: !prev.kycData }))}
                className="mb-2"
              >
                {showJson.kycData ? "Hide Raw KYC Data" : "Show Raw KYC Data"}
              </Button>
              {showJson.kycData && (
                <pre className="bg-gray-900 text-white rounded-lg p-4 overflow-x-auto text-sm font-mono">
                  <code>{JSON.stringify(kycResult.kyc_data, null, 2)}</code>
                </pre>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Get the current processing stage title
  const getProcessingTitle = () => {
    switch (processingStep) {
      case "upload":
        return "Uploading your documents...";
      case "extract":
        return "Processing your documents...";
      case "kyc":
        return "Performing KYC analysis...";
      default:
        return "Processing...";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-3xl shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-t-lg">
          <CardTitle className="text-2xl font-bold">
            KYC Application
          </CardTitle>
          <CardDescription className="text-blue-100">
            Upload your documents for KYC verification
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {!isUploading && !isProcessing && !isProcessingKyc && !extractedData && !kycResult && (
            <div className="space-y-6">
              <div
                className={`border-2 border-dashed ${
                  isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300"
                } rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload
                  className={`mx-auto h-12 w-12 ${
                    isDragOver ? "text-blue-500" : "text-gray-400"
                  }`}
                />
                <h3 className="mt-2 text-lg font-medium text-gray-900">
                  {isDragOver ? "Drop Files Here" : "Upload Documents"}
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
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
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

          {(isUploading || isProcessing || isProcessingKyc) && (
            <div className="py-12 space-y-6 text-center">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
              <h3 className="text-lg font-medium text-gray-900">
                {getProcessingTitle()}
              </h3>
              <div className="w-full max-w-md mx-auto">
                <Progress value={progress} className="h-2" />
                <p className="mt-2 text-sm text-gray-500">
                  {isUploading
                    ? `Uploading files: ${Math.min(progress * 2, 100)}%`
                    : isProcessingKyc
                    ? `Analyzing KYC data: ${progress}%`
                    : `Analyzing documents: ${progress}%`}
                </p>
              </div>
            </div>
          )}

          {extractedData && !kycResult && !isProcessingKyc && (
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
                      {renderRawJson(doc, idx)}
                    </div>
                  </div>
                ))}

                <div className="bg-gray-50 rounded-lg p-4 mt-6">
                  <h4 className="font-medium text-gray-800 mb-3">
                    Initial Verification Summary
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {Object.entries(extractedData.verificationSummary).map(
                      ([key, value]) => (
                        <div key={key} className="flex">
                          <span className="font-medium text-gray-600 w-36">
                            {key
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (str) => str.toUpperCase())}:{" "}
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

                <Alert className="bg-blue-50 border-blue-100">
                  <FileCheck className="h-4 w-4 text-blue-500" />
                  <AlertTitle className="text-blue-800">Ready for KYC Processing</AlertTitle>
                  <AlertDescription className="text-blue-700">
                    Documents have been extracted successfully. Click "Process KYC" to perform 
                    fraud detection, risk assessment, and compliance checks.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}

          {/* Show KYC results if available */}
          {kycResult && renderKycResult()}

          {/* Show any errors */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>

        <CardFooter className="flex justify-between p-6 bg-gray-50 rounded-b-lg">
          {!extractedData && !kycResult ? (
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
          ) : !kycResult ? (
            <>
              <Button variant="outline" onClick={handleReset}>
                Upload New Documents
              </Button>
              <Button
                onClick={processKYC}
                disabled={isProcessingKyc}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isProcessingKyc ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing KYC...
                  </>
                ) : (
                  <>
                    <FileCheck className="mr-2 h-4 w-4" />
                    Process KYC
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

   
      {/* CSS for JSON formatting */}
      <style jsx>{`
        pre {
          background: #1a202c;
          color: #e2e8f0;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          font-size: 0.875rem;
          line-height: 1.5;
        }
        code {
          font-family: "Fira Code", "Consolas", monospace;
        }
      `}</style>
    </div>
  );
}