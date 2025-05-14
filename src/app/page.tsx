"use client";
import type { JSX } from "react";
import {
  Upload,
  FileText,
  Loader2,
  Check,
  AlertCircle,
  FileCheck,
} from "lucide-react";
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
interface DocumentData {
  [key: string]: string | number | boolean | DocumentData | null;
}

interface Document {
  filename: string;
  type: string;
  data: DocumentData;
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
  kyc_data: {
    documentData: Document[] | Document;
    verificationSummary: VerificationSummary;
    FraudDetection?: {
      FraudAnalysis: string;
      FraudRiskScore: number;
      finalResponse: string;
    };
    RiskAssessment?: {
      RiskAnalysis: string;
      RiskScore: number;
      finalResponse: string;
    };
    ComplianceCheck?: {
      ComplianceAnalysis: string;
      ComplianceStatus: string;
      finalResponse: string;
    };
  };
}

export default function DocumentUploadApp() {
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(
    null
  );
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
        throw new Error(
          `Failed to upload ${file.name}: ${response.statusText}`
        );
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

      // Simplified verification summary
      const formattedData: ExtractedData = {
        documents: parsedDocuments,
        verificationSummary: {
          identityVerified: true,
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
      const combinedData = {
        documentData: extractedData.documents.map((doc) => ({
          filename: doc.filename,
          data: doc.data,
        })),
        verificationSummary: extractedData.verificationSummary,
      };

      const processInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            clearInterval(processInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

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
        throw new Error(
          `KYC Processing failed: ${
            errorData.message || kycResponse.statusText
          }`
        );
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
  const toggleJson = (index: number | string) => {
    setShowJson((prev: any) => ({ ...prev, [index]: !prev[index] }));
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

  // Utility function to render nested data
  const renderNestedData = (data: any, prefix: string = ""): JSX.Element[] => {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
      return [
        <div key={prefix} className="flex">
          <span className="font-medium text-gray-600 w-40 capitalize">
            {prefix.replace(/_/g, " ")}:
          </span>
          <span className="text-gray-800">
            {typeof data === "number"
              ? `₹${data.toLocaleString()}`
              : typeof data === "boolean"
              ? data
                ? "Yes"
                : "No"
              : data || "N/A"}
          </span>
        </div>,
      ];
    }

    return Object.entries(data).flatMap(([key, value]) => {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        return renderNestedData(value, newKey);
      }
      return (
        <div key={newKey} className="flex">
          <span className="font-medium text-gray-600 w-40 capitalize">
            {newKey.replace(/_/g, " ")}:
          </span>
          <span className="text-gray-800">
            {typeof value === "number"
              ? `₹${value.toLocaleString()}`
              : typeof value === "boolean"
              ? value
                ? "Yes"
                : "No"
              : value || "N/A"}
          </span>
        </div>
      );
    });
  };

  // Render the KYC result data with enhanced UI
  const renderKycResult = () => {
    if (!kycResult) return null; // Fixed: removed "admin" prefix from kycResult

    // Normalize documentData to always be an array
    const documentData = Array.isArray(kycResult?.kyc_data.documentData)
      ? kycResult?.kyc_data.documentData
      : kycResult?.kyc_data.documentData
      ? [kycResult?.kyc_data.documentData]
      : [];

    return (
      <div className="mt-8 space-y-6">
        <div className="flex items-center space-x-3">
          <Check className="h-8 w-8 text-green-500" />
          <h2 className="text-2xl font-semibold text-gray-800">
            KYC Verification Complete
          </h2>
        </div>

        {/* Overview Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-none shadow-md">
          <CardHeader>
            <CardTitle className="text-xl text-blue-800">
              Verification Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">Status</p>
              <p
                className={`text-lg font-semibold ${
                  kycResult?.message.includes("successful")
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {kycResult?.message}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">
                Identity Verified
              </p>
              <p
                className={`text-lg font-semibold ${
                  kycResult?.kyc_data.verificationSummary.identityVerified
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {kycResult?.kyc_data.verificationSummary.identityVerified
                  ? "Yes"
                  : "No"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-600">
                Recommended Action
              </p>
              <p
                className={`text-lg font-semibold ${
                  kycResult?.kyc_data.verificationSummary.recommendedAction ===
                  "Approve"
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {kycResult?.kyc_data.verificationSummary.recommendedAction}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Analysis Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Fraud Detection */}
          {kycResult?.kyc_data?.FraudDetection && (
            <Card className="border-none shadow-md">
              <CardHeader className="bg-green-50">
                <CardTitle className="text-lg text-green-800">
                  Fraud Detection
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Result:
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      kycResult?.kyc_data.FraudDetection.finalResponse ===
                      "SUCCESS"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {kycResult?.kyc_data.FraudDetection.finalResponse}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Fraud Risk Score:
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      kycResult?.kyc_data.FraudDetection.FraudRiskScore < 50
                        ? "text-green-600"
                        : kycResult?.kyc_data.FraudDetection.FraudRiskScore < 75
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {kycResult?.kyc_data.FraudDetection.FraudRiskScore}/100
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">
                    Analysis:
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {kycResult?.kyc_data.FraudDetection.FraudAnalysis}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Assessment */}
          {kycResult?.kyc_data?.RiskAssessment && (
            <Card className="border-none shadow-md">
              <CardHeader className="bg-yellow-50">
                <CardTitle className="text-lg text-yellow-800">
                  Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Result:
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      kycResult?.kyc_data.RiskAssessment.finalResponse ===
                      "SUCCESS"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {kycResult?.kyc_data.RiskAssessment.finalResponse}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Risk Score:
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      kycResult?.kyc_data.RiskAssessment.RiskScore < 50
                        ? "text-green-600"
                        : kycResult?.kyc_data.RiskAssessment.RiskScore < 75
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {kycResult?.kyc_data.RiskAssessment.RiskScore}/100
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">
                    Analysis:
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {kycResult?.kyc_data.RiskAssessment.RiskAnalysis}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compliance Check */}
          {kycResult?.kyc_data?.ComplianceCheck && (
            <Card className="border-none shadow-md">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-lg text-blue-800">
                  Compliance Check
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Result:
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      kycResult?.kyc_data.ComplianceCheck.finalResponse ===
                      "SUCCESS"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {kycResult?.kyc_data.ComplianceCheck.finalResponse}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Compliance Status:
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      kycResult?.kyc_data.ComplianceCheck.ComplianceStatus ===
                      "Compliant"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {kycResult?.kyc_data.ComplianceCheck.ComplianceStatus}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-2">
                    Analysis:
                  </p>
                  <p className="text-sm text-gray-700">
                    {kycResult?.kyc_data.ComplianceCheck.ComplianceAnalysis}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Document Data */}
        {documentData.length > 0 && (
          <Card className="border-none shadow-md">
            <CardHeader>
              <CardTitle className="text-xl text-gray-800">
                Document Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {documentData.map((doc: Document, idx: number) => (
                <div key={idx} className="border-b pb-4 last:border-b-0">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-lg font-medium text-gray-800">
                      {doc.filename}
                    </h4>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      PDF
                    </span>
                  </div>
                  <div className="mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleJson("kycData")}
                      className="mb-4"
                    >
                      {showJson.kycData
                        ? "Hide Raw KYC Data"
                        : "Show Raw KYC Data"}
                    </Button>
                    {showJson.kycData && (
                      <pre className="bg-gray-900 text-white rounded-lg p-4 overflow-x-auto text-sm font-mono">
                        <code>
                          {JSON.stringify(kycResult?.kyc_data, null, 2)}
                        </code>
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Raw KYC Data Toggle */}
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
      <Card className="w-full max-w-4xl shadow-xl">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
          <CardTitle className="text-3xl font-bold">
            KYC Verification Portal
          </CardTitle>
          <CardDescription className="text-blue-100">
            Securely upload and verify your documents
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8">
          {!isUploading &&
            !isProcessing &&
            !isProcessingKyc &&
            !extractedData &&
            !kycResult && (
              <div className="space-y-8">
                <div
                  className={`border-2 border-dashed rounded-xl p-10 text-center transition-all duration-300 ${
                    isDragOver
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-blue-500"
                  } cursor-pointer`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <Upload
                    className={`mx-auto h-16 w-16 ${
                      isDragOver ? "text-blue-500" : "text-gray-400"
                    } transition-colors`}
                  />
                  <h3 className="mt-4 text-xl font-semibold text-gray-900">
                    {isDragOver ? "Drop Files Here" : "Upload Documents"}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Drag and drop your PDF files or click to browse
                  </p>
                  <p className="mt-2 text-xs text-gray-400">
                    Only PDF files supported (Max 10MB each)
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
                  <div className="mt-6">
                    <h4 className="font-semibold text-gray-700 mb-4">
                      Selected Files ({files.length})
                    </h4>
                    <div className="space-y-3">
                      {files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center p-3 bg-gray-50 rounded-lg group hover:bg-gray-100 transition"
                        >
                          <FileText className="h-6 w-6 text-blue-500 mr-3" />
                          <span className="text-sm text-gray-600 flex-1">
                            {file.name}
                          </span>
                          <span className="text-xs text-gray-500 mr-3">
                            {(file.size / 1024).toFixed(0)} KB
                          </span>
                          <button
                            onClick={() => handleRemoveFile(index)}
                            className="text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
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
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-5 w-5" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}

          {(isUploading || isProcessing || isProcessingKyc) && (
            <div className="py-16 space-y-8 text-center">
              <Loader2 className="h-16 w-16 animate-spin mx-auto text-blue-600" />
              <h3 className="text-xl font-semibold text-gray-900">
                {getProcessingTitle()}
              </h3>
              <div className="w-full max-w-md mx-auto">
                <Progress value={progress} className="h-3 rounded-full" />
                <p className="mt-3 text-sm text-gray-500">
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
            <div className="space-y-8">
              <div className="flex items-center space-x-3 text-green-600">
                <Check className="h-8 w-8" />
                <h3 className="text-2xl font-semibold">
                  Documents Processed Successfully
                </h3>
              </div>

              <div className="space-y-6">
                <h4 className="font-semibold text-gray-800 text-lg">
                  Document Analysis
                </h4>

                {extractedData.documents.map((doc, idx) => (
                  <Card key={idx} className="border-none shadow-md">
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <h5 className="font-semibold text-gray-800">
                          {doc.filename}
                        </h5>
                        <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                          {doc.type}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>{renderRawJson(doc, idx)}</CardContent>
                  </Card>
                ))}

                <Card className="bg-gray-50">
                  <CardHeader>
                    <CardTitle className="text-lg text-gray-800">
                      Initial Verification Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {Object.entries(extractedData.verificationSummary).map(
                        ([key, value]) => (
                          <div key={key} className="flex">
                            <span className="font-medium text-gray-600 w-40 capitalize">
                              {key
                                .replace(/([A-Z])/g, " $1")
                                .replace(/^./, (str) => str.toUpperCase())}
                              :
                            </span>
                            <span
                              className={`font-semibold ${
                                value === "Low" ||
                                value === true ||
                                value === "Approve"
                                  ? "text-green-600"
                                  : value === "Medium" || value === "Review"
                                  ? "text-amber-600"
                                  : value === "High" || value === "Reject"
                                  ? "text-red-600"
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
                  </CardContent>
                </Card>

                <Alert className="bg-blue-50 border-blue-200">
                  <FileCheck className="h-5 w-5 text-blue-500" />
                  <AlertTitle className="text-blue-800">
                    Ready for KYC Processing
                  </AlertTitle>
                  <AlertDescription className="text-blue-700">
                    Documents have been extracted successfully. Click "Process
                    KYC" to perform fraud detection, risk assessment, and
                    compliance checks.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          )}

          {kycResult && renderKycResult()}

          {error && (
            <Alert variant="destructive" className="mt-6">
              <AlertCircle className="h-5 w-5" />
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
                className="bg-blue-600 hover:bg-blue-700"
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
              {/* <Button
                onClick={handleGenerateReport}
                className="bg-green-600 hover:bg-green-700"
              >
                Generate KYC Report
              </Button> */}
            </>
          )}
        </CardFooter>
      </Card>

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
