import { prepareInstructions } from "../../constants";
import React, { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import FileUploader from "~/components/FileUploader";
import Navbar from "~/components/Navbar";
import { convertPdfToImage } from "~/lib/pdf2img";
import { usePuterStore } from "~/lib/puter";
import { generateUUID } from "~/lib/utils";
import { AIResponseFormat } from "../../constants";

const upload = () => {
  const {auth, isLoading, fs, ai, kv} = usePuterStore();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("")
  const [file, setFile] = useState<File |null >(null)

  const handleFileSelect = (file: File | null) => {
    setFile(file);
  }

  const handleAnalyse = async ({companyName, jobTitle, jobDescription, file} : {companyName: string, jobTitle: string, jobDescription: string, file: File}) => {
    try {
      setIsProcessing(true);
      setStatusText("Uploading resume...");

      const uploadFile = await fs.upload([file])
      if(!uploadFile) {
        setStatusText('error: failed to upload file');
        return;
      }

      setStatusText("converting to image...");

      const imageResult = await convertPdfToImage(file); 
      if(!imageResult.file) {
        setStatusText(`error: failed to convert pdf to image - ${imageResult.error}`);
        return;
      }

      setStatusText("uploading image...");
      const uploadImageFile = await fs.upload([imageResult.file]);
      if(!uploadImageFile) {
        setStatusText('error: failed to upload image file');
        return;
      }

      setStatusText('preparing data for analysis...');
      
      const uuid = generateUUID();

      const data = {
        id: uuid,
        filePath: uploadFile.path,
        imagePath: uploadImageFile.path,
        companyName,
        jobTitle,
        jobDescription,
        feedback: '',
      }
      console.log(data)


      await kv.set(`resume:${uuid}`, JSON.stringify(data));
      console.log('set the data in kv store');
      setStatusText('analyzing resume...');

      const feedback = await ai.feedback(
        uploadFile.path,
        prepareInstructions({jobTitle, jobDescription, AIResponseFormat})
      );

      if(!feedback) {
        setStatusText('error: failed to analyze resume');
        return;
      }

      const feedbackText = typeof feedback.message.content === 'string' ? 
      feedback.message.content : feedback.message.content[0].text;
      
      data.feedback = JSON.parse(feedbackText);
      
      await kv.set(`resume:${uuid}`, JSON.stringify(data));
      setStatusText('analysis complete! redirecting...');

      //console.log(data);
      navigate(`/resume/${uuid}`);
    } catch (error) {
      setStatusText(`error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      setIsProcessing(false);
    }
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget.closest('form')

    if(!form) return;

    const formData = new FormData(form);

    const companyName = formData.get('company-name') as string;
    const jobTitle = formData.get('job-title') as string;
    const jobDescription = formData.get('job-description') as string;

    
    if(!file) return;
    handleAnalyse({companyName, jobTitle, jobDescription, file});

  }

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      <Navbar />
      <section className="main-section">
        <div className="page-heading py-16">
          <h1>Smart feedback for your dream job</h1>
          {isProcessing ? (
            <>
              <h2>{statusText}</h2>
              <img src="/images/resume-scan.gif" className="w-full" />
            </>
          ) : (
            <h2>Upload your resume for ATS review</h2>
          )}
          {!isProcessing && (
            <form
              id="upload-form"
              onSubmit={handleSubmit}
              className="flex flex-col gap-4 mt-8"
            >
              <div className="form-div">
                <label htmlFor="company-name">Company Name</label>
                <input
                  type="text"
                  id="company-name"
                  name="company-name"
                  placeholder="Company Name"
                />
              </div>
              <div className="form-div">
                <label htmlFor="job-title">Job Title</label>
                <input
                  type="text"
                  id="job-title"
                  name="job-title"
                  placeholder="Job-title"
                />
              </div>
              <div className="form-div">
                <label htmlFor="job-description">Job Description</label>
                <textarea
                  rows={5}
                  id="job-description"
                  name="job-description"
                  placeholder="Job Description"
                />
              </div>
              <div className="form-div">
                <label htmlFor="uploader">Resume Uploader</label>
                <FileUploader onFileSelect={handleFileSelect}/>
              </div>
              <button type="submit" className="primary-button">Analyse Resume</button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
};

export default upload;
