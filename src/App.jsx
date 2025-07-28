import { useState, useEffect, useRef } from "react";
import axios from "axios";
import * as pdfjsLib from "pdfjs-dist/build/pdf";
import "pdfjs-dist/build/pdf.worker.min.js";
import Upload from "@mui/icons-material/Upload";

const App = () => {
  const [pdfFile, setPdfFile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [pdfPages, setPdfPages] = useState([]);
  const pdfViewerRef = useRef(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [pdfURL, setPdfURL] = useState(null);
  // Set PDF.js worker
  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "/node_modules/pdfjs-dist/build/pdf.worker.min.js";
  }, []);

  const simulateUpload = (file) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
        const blobURL = URL.createObjectURL(file);
        setPdfURL(blobURL);
      }
    }, 200);
  };
  // Handle PDF upload
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      simulateUpload(file);
      const formData = new FormData();
      formData.append("pdf", file);
      try {
        const response = await axios.post(
          "http://localhost:3000/upload",
          formData
        );
        setPdfPages(response.data.pages);
      } catch (error) {
        console.error("Error uploading PDF:", error);
      }
    }
  };

  // Render PDF in viewer
  useEffect(() => {
    if (pdfURL && pdfFile && pdfViewerRef.current) {
      const fileReader = new FileReader();
      fileReader.onload = async () => {
        const typedArray = new Uint8Array(fileReader.result);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        const container = pdfViewerRef.current;
        container.innerHTML = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const scale = 1.5;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.id = `page-${i}`;
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          container.appendChild(canvas);
          const context = canvas.getContext("2d");
          await page.render({ canvasContext: context, viewport }).promise;
        }
      };
      fileReader.readAsArrayBuffer(pdfFile);
    }
  }, [pdfFile, pdfURL]);

  // Handle chat submission
  const handleSend = async () => {
    if (!input.trim() || !pdfFile) return;
    const userMessage = { text: input, sender: "user" };
    setMessages([...messages, userMessage]);
    setInput("");
    try {
      const response = await axios.post("http://localhost:3000/query", {
        question: input,
        pdfPages: pdfPages,
      });
      const botMessage = {
        text: response.data.answer,
        sender: "bot",
        citations: response.data.citations || [],
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error querying:", error);
      const botMessage = {
        text: "Network Error",
        sender: "bot",
        citations: [],
      };
      setMessages((prev) => [...prev, botMessage]);
    }
  };

  // Scroll to PDF page
  const scrollToPage = (pageNum) => {
    const pageElement = document.getElementById(`page-${pageNum}`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <div className="flex items-center justify-center min-h-screen px-4">
        {!pdfFile && (
          <div className="bg-white border border-dashed border-gray-300 p-8 rounded-xl shadow-sm text-center max-w-md w-full">
            <div className="flex justify-center mb-4">
              <Upload style={{ fontSize: 40 }} className="text-purple-500" />
            </div>
            <h2 className="text-lg font-medium text-gray-800">
              Upload PDF to start chatting
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Click or drag and drop your file here
            </p>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              id="file-upload"
              onChange={handlePdfUpload}
            />
            <label
              htmlFor="file-upload"
              className="inline-block cursor-pointer bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 text-sm transition"
            >
              Choose File
            </label>
          </div>
        )}
        {pdfFile && !pdfURL && (
          <div className="relative mt-4 w-full max-w-md border border-gray-300 rounded-xl p-4 shadow-md bg-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{pdfFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(pdfFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            </div>

            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>

            <p className="text-xs text-right mt-1 text-gray-600">
              {uploadProgress}%
            </p>
          </div>
        )}
        {pdfURL && (
          <div className="flex flex-col md:flex-row h-screen">
            <div className="w-full md:w-1/2 p-4">
              <input
                type="file"
                accept="application/pdf"
                onChange={handlePdfUpload}
                className="mb-4 p-2 border rounded"
              />
              <div
                ref={pdfViewerRef}
                id="pdf-viewer"
                className="overflow-auto"
              ></div>
            </div>
            <div className="w-full md:w-1/2 p-4 flex flex-col">
              <div className="chat-container flex-grow">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`mt-10 p-3 rounded-xl ${
                      msg.sender === "user" ? "bg-[#e0f7fa]" : "bot-message"
                    }`}
                  >
                    {msg.text}
                    {msg.citations &&
                      msg.citations.map((citation, i) => (
                        <button
                          key={i}
                          className="citation-btn"
                          onClick={() => scrollToPage(citation.page)}
                        >
                          Page {citation.page}
                        </button>
                      ))}
                  </div>
                ))}
              </div>
              <div className="flex mt-4">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  className="flex-grow p-2 border rounded-l"
                  placeholder="Ask about the PDF..."
                />
                <button
                  onClick={handleSend}
                  className="p-2 bg-blue-500 text-white rounded-r"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default App;
