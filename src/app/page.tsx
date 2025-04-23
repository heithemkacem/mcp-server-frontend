"use client";

import { useState, useEffect } from "react";
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

// TypeScript interfaces
interface ExtractedInfo {
  customerName?: string;
  customerID?: string;
  dateOfBirth?: string;
  address?: string;
  idNumber?: string;
  verificationStatus?: string;
  passportNumber?: string;
  nationality?: string;
  issueDate?: string;
  expiryDate?: string;
}

interface Document {
  filename: string;
  type: string;
  extractedInfo: ExtractedInfo;
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

// Mock data for the extraction results
const mockExtractedData: ExtractedData = {
  documents: [
    {
      filename: "invoice.pdf",
      type: "PDF",
      extractedInfo: {
        customerName: "John Smith",
        customerID: "CS-12345",
        dateOfBirth: "15/03/1985",
        address: "123 Main Street, New York, NY 10001",
        idNumber: "ID-987654321",
        verificationStatus: "Verified",
      },
    },
    {
      filename: "passport.jpg",
      type: "Image",
      extractedInfo: {
        customerName: "John Smith",
        passportNumber: "P12345678",
        nationality: "United States",
        issueDate: "01/01/2020",
        expiryDate: "01/01/2030",
        verificationStatus: "Pending",
      },
    },
  ],
  verificationSummary: {
    identityVerified: true,
    riskScore: "Low",
    recommendedAction: "Approve",
  },
};

export default function DocumentUploadApp() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      setFiles(Array.from(e.target.files));
    }
  };

  // Handle file upload and processing
  const handleUpload = () => {
    if (files.length === 0) {
      setError("Please select at least one file to upload");
      return;
    }

    setError(null);
    setIsUploading(true);

    // Simulate upload completion
    setTimeout(() => {
      setIsUploading(false);
      setIsProcessing(true);

      // Simulate processing with progress updates
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 20;
        setProgress(currentProgress);

        if (currentProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsProcessing(false);
            setExtractedData(mockExtractedData);
          }, 500);
        }
      }, 1000);
    }, 1500);
  };

  // Reset everything to upload more files
  const handleReset = () => {
    setFiles([]);
    setExtractedData(null);
    setProgress(0);
  };

  // Generate KYC report
  const handleGenerateReport = () => {
    alert("KYC Report generated and ready for download!");
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
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">
                  Upload Documents
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Drag and drop your files here or click to browse
                </p>
                <p className="mt-2 text-xs text-gray-500">
                  Supports PDF, Word, JSON, JPG, PNG (Max 10MB each)
                </p>
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {files.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium text-gray-700 mb-2">
                    Selected Files:
                  </h4>
                  <div className="space-y-2">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center p-2 bg-gray-50 rounded"
                      >
                        <FileText className="h-5 w-5 text-blue-500 mr-2" />
                        <span className="text-sm text-gray-600 flex-1">
                          {file.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
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
                  value={isUploading ? 100 : progress}
                  className="h-2"
                />
                <p className="mt-2 text-sm text-gray-500">
                  {isUploading
                    ? "Transferring files..."
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
                  Extracted Information:
                </h4>

                {extractedData.documents.map((doc, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h5 className="font-medium">{doc.filename}</h5>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {doc.type}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {Object.entries(doc.extractedInfo).map(([key, value]) => (
                        <div key={key} className="flex">
                          <span className="font-medium text-gray-600 w-36">
                            {key}:{" "}
                          </span>
                          <span className="text-gray-800">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="bg-gray-50 rounded-lg p-4 mt-4">
                  <h4 className="font-medium text-gray-800 mb-2">
                    Verification Summary
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    {Object.entries(extractedData.verificationSummary).map(
                      ([key, value]) => (
                        <div key={key} className="flex">
                          <span className="font-medium text-gray-600 w-36">
                            {key}:{" "}
                          </span>
                          <span
                            className={`${
                              value === "Low" ||
                              value === true ||
                              value === "Approve"
                                ? "text-green-600"
                                : "text-gray-800"
                            }`}
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
