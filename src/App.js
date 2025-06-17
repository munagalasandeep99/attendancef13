import React, { useState, useRef, useEffect, useCallback } from 'react';
// The AWS SDK will be accessed globally as 'AWS' or 'window.AWS' because it is loaded via a <script> tag in index.html.

// Main App Component
const App = () => {
  // State to manage which section is currently active
  const [activeTab, setActiveTab] = useState('register'); // 'register', 'capture', 'analytics'

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 antialiased flex flex-col items-center p-4">
      {/* Tailwind CSS Script - Recommended to place in public/index.html <head> */}
      <script src="https://cdn.tailwindcss.com"></script>
      {/* Font Inter for consistent typography - Recommended to place in public/index.html <head> */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght400;500;600;700&display=swap" rel="stylesheet" />
      {/* The AWS SDK script should remain in your public/index.html to be globally available: */}
      {/* <script src="https://sdk.amazonaws.com/js/aws-sdk-2.1158.0.min.js"></script> */}
      <style>
        {`
          /* Ensure body uses Inter font */
          body {
            font-family: 'Inter', sans-serif;
          }
          /* Custom styling for file input to hide default and show a custom button */
          .custom-file-input::-webkit-file-upload-button {
            visibility: hidden;
          }
          .custom-file-input::before {
            content: 'Choose File'; /* Text for the custom button */
            display: inline-block;
            background: #e0e0e0; /* Button background color */
            border: 1px solid #ccc; /* Button border */
            border-radius: 0.5rem; /* Rounded corners for the button */
            padding: 0.5rem 1rem; /* Padding inside the button */
            outline: none; /* Remove outline on focus */
            white-space: nowrap; /* Prevent text wrapping */
            -webkit-user-select: none; /* Prevent text selection */
            cursor: pointer; /* Change cursor to pointer on hover */
            font-weight: 500; /* Medium font weight */
            font-size: 0.875rem; /* Small font size */
            margin-right: 0.5rem; /* Space between button and file name */
            transition: background-color 0.2s ease-in-out; /* Smooth transition for hover effect */
          }
          .custom-file-input:hover::before {
            background-color: #d0d0d0; /* Darken background on hover */
          }
          .custom-file-input:active::before {
            background-color: #c0c0c0; /* Even darker on click */
          }
        `}
      </style>

      {/* Navigation Header */}
      <header className="w-full max-w-4xl bg-white p-4 rounded-xl shadow-lg mb-8 flex justify-center space-x-4">
        {/* Button for Register Employee tab */}
        <button
          onClick={() => setActiveTab('register')}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
            activeTab === 'register'
              ? 'bg-blue-600 text-white shadow-md' // Active state styling
              : 'bg-blue-500 text-white hover:bg-blue-600' // Inactive state styling
          }`}
        >
          Register Employee
        </button>
        {/* Button for Capture Attendance tab */}
        <button
          onClick={() => setActiveTab('capture')}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
            activeTab === 'capture'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          Capture Attendance
        </button>
        {/* Button for View Analytics tab */}
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-6 py-3 rounded-lg font-medium transition-all duration-300 ${
            activeTab === 'analytics'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          View Analytics
        </button>
      </header>

      {/* Main Content Area: Renders the active component based on activeTab state */}
      <main className="w-full max-w-4xl bg-white p-8 rounded-xl shadow-lg">
        {activeTab === 'register' && <EmployeeRegistration />}
        {activeTab === 'capture' && <AttendanceCapture />}
        {activeTab === 'analytics' && <AttendanceAnalytics />}
      </main>
    </div>
  );
};

// Helper function to convert Data URL to Blob for S3 upload
const dataURLtoBlob = (dataurl) => {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
};

// Employee Registration Component
const EmployeeRegistration = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [photoFile, setPhotoFile] = useState(null); // For file uploads
  const [fileName, setFileName] = useState('No file chosen'); // Display file name
  const [isWebcamPanelOpen, setIsWebcamPanelOpen] = useState(false); // Controls visibility of webcam UI
  const [isWebcamStreamReady, setIsWebcamStreamReady] = useState(false); // Indicates if stream is actively playing and ready
  const videoRef = useRef(null); // Ref for the <video> element to display webcam feed
  const canvasRef = useRef(null); // Ref for the <canvas> element to capture photo
  const [stream, setStream] = useState(null); // To hold the MediaStream object from getUserMedia
  const [webcamError, setWebcamError] = useState(''); // To display webcam access errors
  const [capturedImage, setCapturedImage] = useState(null); // To store the captured image Data URL
  const [uploadMessage, setUploadMessage] = useState(''); // State for S3 upload success message
  const [uploadError, setUploadError] = useState(''); // State for S3 upload error message

  // Configure AWS SDK credentials with Cognito Identity Pool
  useEffect(() => {
    if (typeof window.AWS === 'undefined') { // Check window.AWS as it's loaded via script tag
        console.error("AWS SDK not loaded. Please ensure the AWS SDK script is included in your index.html.");
        setUploadError("AWS SDK not loaded. Cannot upload files.");
        return;
    }

    // Set AWS region and Identity Pool ID from user's provided values
    window.AWS.config.region = 'ap-south-1';
    window.AWS.config.credentials = new window.AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'ap-south-1:fbe13061-500e-4f08-938d-176d6f6f2551',
    });

    // Optional: Refresh credentials to verify setup and handle potential expiration
    window.AWS.config.credentials.get(function(err){
        if(err) {
            console.error("Error retrieving AWS credentials for Employee Registration:", err);
            setUploadError("Failed to get AWS credentials. Check Identity Pool configuration and network.");
        } else {
            console.log("AWS credentials successfully retrieved for Employee Registration.");
            // You can optionally clear upload error here if it was previously set due to credential issues
            setUploadError('');
        }
    });
  }, []); // Run once on component mount

  const openWebcamPanel = () => {
    console.log('Webcam Init Debug: Opening webcam panel...');
    setWebcamError(''); // Clear any previous webcam errors
    setCapturedImage(null); // Clear any previously captured image
    setPhotoFile(null); // Clear any previously selected file
    setFileName('No file chosen'); // Reset file name display
    setIsWebcamStreamReady(false); // Reset stream ready state
    setIsWebcamPanelOpen(true); // Open the webcam UI panel
    setUploadMessage(''); // Clear any previous upload messages
    setUploadError(''); // Clear any previous upload errors
  };

  // Function to stop the webcam stream and clean up
  const stopWebcam = () => {
    console.log('Webcam Init Debug: Stopping webcam...');
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Webcam Init Debug: Track stopped:', track.kind);
      });
      setStream(null); // Clear the stream
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null; // Clear video element source
        videoRef.current.oncanplay = null; // Remove listener
        videoRef.current.onerror = null; // Remove listener
        videoRef.current.pause(); // Pause video
        videoRef.current.load(); // Load to reset state
        console.log('Webcam Init Debug: Video element cleaned up.');
    }
    setIsWebcamPanelOpen(false); // Close webcam UI panel
    setIsWebcamStreamReady(false); // Reset stream ready state
    setWebcamError(''); // Clear any webcam errors
    // Captured image is intentionally NOT cleared here, as it should remain after capture
    console.log('Webcam Init Debug: Webcam stopped.');
  };

  // useEffect to handle media stream acquisition and video element setup
  useEffect(() => {
    let currentStream = null; // Local variable to hold stream during effect lifecycle

    const initWebcam = async () => {
      console.log('Webcam Init Debug: useEffect - Initializing webcam stream...');
      if (!videoRef.current) {
        console.warn('Webcam Init Debug: useEffect - videoRef.current is null, cannot initialize webcam.');
        setWebcamError('Error: Video display element not found. Please refresh.');
        return;
      }

      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(currentStream); // Store stream in state
        videoRef.current.srcObject = currentStream; // Assign stream to video element

        const handleCanPlay = () => {
          console.log('Webcam Init Debug: Video is ready to play (oncanplay event). Dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          videoRef.current.play(); // Ensure video plays
          setIsWebcamStreamReady(true); // Mark stream as ready
        };

        const handleError = (e) => {
            console.error("Webcam Init Debug: Video element error:", e);
            setWebcamError("Video playback error. Please try restarting webcam.");
            setIsWebcamStreamReady(false);
            // Attempt to stop the stream if an error occurs
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
                setStream(null);
            }
        };

        videoRef.current.addEventListener('canplay', handleCanPlay);
        videoRef.current.addEventListener('error', handleError);

        // If video is already ready (e.g., fast re-mount), fire handleCanPlay manually
        if (videoRef.current.readyState >= 3) { // HAVE_FUTURE_DATA
            handleCanPlay();
        }

      } catch (err) {
        console.error('Webcam Init Debug: Error accessing webcam in useEffect:', err);
        setWebcamError(`Error accessing webcam: ${err.name}. Please ensure camera is available and permissions are granted.`);
        setIsWebcamStreamReady(false);
        // Clean up any partially obtained stream
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
      }
    };

    // Only attempt to initialize webcam if the panel is open AND a video ref is available
    if (isWebcamPanelOpen) {
        initWebcam();
    }

    // Cleanup function: stop webcam when component unmounts or isWebcamPanelOpen becomes false
    return () => {
      console.log('Webcam Init Debug: useEffect cleanup running.');
      if (currentStream) { // Use local currentStream for cleanup consistency
        currentStream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.removeEventListener('canplay', initWebcam); // Remove the listener
        videoRef.current.removeEventListener('error', initWebcam); // Remove the listener
      }
      setStream(null); // Clear stream from state
      setIsWebcamStreamReady(false); // Reset ready state
    };
  }, [isWebcamPanelOpen]); // Re-run effect when isWebcamPanelOpen changes

  // Function to take a photo from the current webcam feed
  const handleTakePhoto = useCallback(() => {
    console.log('Photo Capture Debug: Attempting to take photo...');
    if (videoRef.current && canvasRef.current && isWebcamStreamReady) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      // Crucial check: Ensure video has valid dimensions before drawing
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.error('Photo Capture Error: Video dimensions are 0. Cannot capture image. Current video state:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState
        });
        setWebcamError('Cannot capture photo: Video stream not ready. Please wait a moment for the feed to stabilize and try again.');
        return;
      }

      console.log('Photo Capture Debug: Video dimensions before drawing:', video.videoWidth, 'x', video.videoHeight);

      // Set canvas dimensions to match the video feed dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current frame of the video onto the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get the image data URL from the canvas (PNG format)
      const imageDataURL = canvas.toDataURL('image/png');
      setCapturedImage(imageDataURL); // Store the captured image
      setPhotoFile(null); // Clear photoFile if webcam is used
      setFileName('No file chosen'); // Clear file name
      console.log('Photo captured!');
      // Log the length of the captured image data URL to verify content
      console.log('Captured image data URL length:', imageDataURL.length);
      // Log a snippet of the data URL to quickly inspect its beginning
      console.log('Captured image data URL snippet:', imageDataURL.substring(0, 100) + '...');

      // --- NEW: Stop webcam after image is captured ---
      stopWebcam();

    } else {
      console.log('Photo Capture Debug: videoRef, canvasRef, or webcam is not current/active.');
      if (!isWebcamStreamReady) {
          setWebcamError('Webcam stream is not ready. Click "Use Webcam" and wait for the feed to appear before taking a photo.');
      }
    }
  }, [videoRef, canvasRef, isWebcamStreamReady, stopWebcam]);

  // Handle file input change
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setPhotoFile(file);
    setFileName(file ? file.name : 'No file chosen');
    setCapturedImage(null); // Clear captured image if file is uploaded
    stopWebcam(); // Stop webcam and clear captured image if user chooses to upload a file
    setUploadMessage(''); // Clear any previous upload messages
    setUploadError(''); // Clear any previous upload errors
  };

  // Handle employee registration submission
  const handleRegister = async () => {
    setUploadMessage(''); // Clear previous messages
    setUploadError(''); // Clear previous errors

    if (!firstName.trim() || !lastName.trim()) {
        setUploadError('Please enter both First Name and Last Name.');
        return;
    }

    if (!photoFile && !capturedImage) {
        setUploadError('Please upload a photo or capture one using the webcam.');
        return;
    }

    let fileToUpload = null;
    let fileExtension = '';

    if (photoFile) { // User uploaded a file
        fileToUpload = photoFile;
        const parts = photoFile.name.split('.');
        if (parts.length > 1) {
            fileExtension = parts.pop().toLowerCase();
        } else {
            // Default to jpg if no extension is found for uploaded file
            fileExtension = 'jpg';
        }
    } else if (capturedImage) { // User captured via webcam
        fileToUpload = dataURLtoBlob(capturedImage); // Convert data URL to Blob
        fileExtension = 'png'; // Captured images are PNG
    }

    if (!fileToUpload) { // Fallback check
        setUploadError('No valid photo source found for upload.');
        return;
    }

    // Check if AWS SDK is properly configured
    if (typeof window.AWS === 'undefined' || !window.AWS.config.credentials || !window.AWS.config.credentials.accessKeyId) {
        setUploadError("AWS SDK credentials not configured. Please check Identity Pool setup and ensure AWS SDK script is loaded.");
        console.error("AWS SDK or credentials not ready.");
        return;
    }

    const s3 = new window.AWS.S3(); // Use window.AWS.S3 for global access
    const bucketName = 'peoplef13';
    // Clean names for file key: replace non-alphanumeric characters with underscores
    const cleanedFirstName = firstName.trim().replace(/[^a-zA-Z0-9]/g, '_');
    const cleanedLastName = lastName.trim().replace(/[^a-zA-Z0-9]/g, '_');
    const objectKey = `${cleanedFirstName}_${cleanedLastName}.${fileExtension}`;

    const uploadParams = {
      Bucket: bucketName,
      Key: objectKey,
      Body: fileToUpload,
      ContentType: fileToUpload.type || `image/${fileExtension}`, // Ensure correct content type
      ACL: 'private', // Or 'public-read' if you want direct URL access. 'private' is generally more secure.
    };

    try {
        setUploadMessage('Uploading photo...');
        const data = await s3.upload(uploadParams).promise(); // Perform the upload
        console.log('Upload successful for Employee Registration:', data.Location);
        setUploadMessage(`Employee registered! Photo uploaded to S3: ${data.Location}`);
        // In a real application, you might now send data (firstName, lastName, data.Location) to your backend
        // to persist employee information in a database.

        // Clear form after successful registration and upload
        setFirstName('');
        setLastName('');
        setPhotoFile(null);
        setFileName('No file chosen');
        setCapturedImage(null);
        setWebcamError(''); // Clear webcam errors
        stopWebcam(); // Ensure webcam is stopped after upload
    } catch (err) {
        console.error('Error uploading photo for Employee Registration:', err);
        setUploadError(`Failed to upload photo: ${err.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-3xl font-bold mb-8 text-gray-900">EMPLOYEE REGISTRATION</h2>

      <div className="w-full space-y-6 max-w-md">
        {/* First Name Input */}
        <div>
          <label htmlFor="firstName" className="block text-lg font-medium text-gray-700 mb-2">
            First Name :
          </label>
          <input
            type="text"
            id="firstName"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter first name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>

        {/* Last Name Input */}
        <div>
          <label htmlFor="lastName" className="block text-lg font-medium text-gray-700 mb-2">
            Last Name :
          </label>
          <input
            type="text"
            id="lastName"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        {/* Upload Photo Input */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            Upload Photo :
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              id="photoUpload"
              accept="image/*" // Accept image files
              className="hidden" // Hide the default browser file input
              onChange={handleFileChange}
            />
            {/* Custom styled label for the file input */}
            <label
              htmlFor="photoUpload"
              className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer shadow-sm text-sm font-medium text-gray-700"
            >
              Choose File
            </label>
            <span className="text-gray-500 text-sm">{fileName}</span> {/* Display chosen file name */}
          </div>
        </div>

        {/* Webcam Controls: Use Webcam / Take Photo buttons */}
        <div className="mt-6 flex justify-center space-x-4">
          {!isWebcamPanelOpen ? ( // Show "Use Webcam" button if panel is closed
            <button
              onClick={openWebcamPanel}
              className="px-8 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-all duration-300 transform hover:scale-105"
            >
              Use Webcam
            </button>
          ) : (
            // Show "Take Photo" if webcam panel is open (Stop Webcam button removed)
            <button
              onClick={handleTakePhoto} // Use the handleTakePhoto function
              className={`px-8 py-3 font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 ${
                isWebcamStreamReady ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-400 text-gray-700 cursor-not-allowed'
              }`}
              disabled={!isWebcamStreamReady} // Disable if stream is not ready
            >
              Take Photo
            </button>
          )}
        </div>

        {/* Webcam Error Message Display */}
        {webcamError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mt-4" role="alert">
            <strong className="font-bold">Webcam Error! </strong>
            <span className="block sm:inline">{webcamError}</span>
          </div>
        )}

        {/* Upload Error Message Display */}
        {uploadError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mt-4" role="alert">
            <strong className="font-bold">Upload Error! </strong>
            <span className="block sm:inline">{uploadError}</span>
          </div>
        )}

        {/* Upload Success Message Display */}
        {uploadMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg relative mt-4" role="alert">
            <strong className="font-bold">Success! </strong>
            <span className="block sm:inline">{uploadMessage}</span>
          </div>
        )}

        {/* Webcam Feed Display using the native <video> element */}
        {isWebcamPanelOpen && ( // Only render video if webcam panel is open
          <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-sm italic border-2 border-dashed border-gray-400 mt-6 overflow-hidden">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover rounded-lg"></video>
            {/* Hidden canvas element used for capturing the image from the video stream */}
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          </div>
        )}

        {/* Captured Image Display */}
        {capturedImage && (
          <div className="mt-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Captured Photo:</h3>
            <div className="w-full h-64 bg-gray-200 rounded-lg overflow-hidden border-2 border-dashed border-gray-400 flex items-center justify-center">
              <img src={capturedImage} alt="Captured from webcam" className="w-full h-full object-contain rounded-lg" />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-8">
          <button
            onClick={handleRegister}
            className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105"
          >
            Register Employee
          </button>
        </div>
      </div>
    </div>
  );
};

// Attendance Capture Component
const AttendanceCapture = () => {
  const [photoFile, setPhotoFile] = useState(null);
  const [fileName, setFileName] = useState('No file chosen');
  const [isWebcamPanelOpen, setIsWebcamPanelOpen] = useState(false);
  const [isWebcamStreamReady, setIsWebcamStreamReady] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [webcamError, setWebcamError] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadMessage, setUploadMessage] = useState(''); // State for S3 upload success message
  const [uploadError, setUploadError] = useState(''); // State for S3 upload error message

  // Configure AWS SDK credentials with Cognito Identity Pool
  useEffect(() => {
    if (typeof window.AWS === 'undefined') { // Check window.AWS as it's loaded via script tag
        console.error("AWS SDK not loaded. Please ensure the AWS SDK script is included in your index.html.");
        setUploadError("AWS SDK not loaded. Cannot upload files.");
        return;
    }

    // Set AWS region and Identity Pool ID from user's provided values
    window.AWS.config.region = 'ap-south-1';
    window.AWS.config.credentials = new window.AWS.CognitoIdentityCredentials({
        IdentityPoolId: 'ap-south-1:fbe13061-500e-4f08-938d-176d6f6f2551',
    });

    // Optional: Refresh credentials to verify setup and handle potential expiration
    window.AWS.config.credentials.get(function(err){
        if(err) {
            console.error("Error retrieving AWS credentials for Attendance Capture:", err);
            setUploadError("Failed to get AWS credentials. Check Identity Pool configuration and network.");
        } else {
            console.log("AWS credentials successfully retrieved for Attendance Capture.");
            setUploadError('');
        }
    });
  }, []); // Run once on component mount

  const openWebcamPanel = () => {
    console.log('Webcam Init Debug: Opening webcam panel (Capture tab)...');
    setWebcamError('');
    setCapturedImage(null);
    setPhotoFile(null); // Clear any previously selected file
    setFileName('No file chosen'); // Reset file name display
    setIsWebcamStreamReady(false);
    setIsWebcamPanelOpen(true);
    setUploadMessage(''); // Clear any previous upload messages
    setUploadError(''); // Clear any previous upload errors
  };

  const stopWebcam = () => {
    console.log('Webcam Init Debug: Stopping webcam (Capture tab)...');
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('Webcam Init Debug: Track stopped (Capture tab):', track.kind);
      });
      setStream(null);
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.oncanplay = null;
        videoRef.current.onerror = null;
        videoRef.current.pause();
        videoRef.current.load();
        console.log('Webcam Init Debug: Video element cleaned up (Capture tab).');
    }
    setIsWebcamPanelOpen(false);
    setIsWebcamStreamReady(false);
    setWebcamError('');
    // Captured image is intentionally NOT cleared here
    console.log('Webcam Init Debug: Webcam stopped (Capture tab).');
  };

  useEffect(() => {
    let currentStream = null;

    const initWebcam = async () => {
      console.log('Webcam Init Debug: useEffect - Initializing webcam stream (Capture tab)...');
      if (!videoRef.current) {
        console.warn('Webcam Init Debug: useEffect - videoRef.current is null, cannot initialize webcam (Capture tab).');
        setWebcamError('Error: Video display element not found. Please refresh.');
        return;
      }

      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(currentStream);
        videoRef.current.srcObject = currentStream;

        const handleCanPlay = () => {
          console.log('Webcam Init Debug: Video is ready to play (oncanplay event - Capture tab). Dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          videoRef.current.play();
          setIsWebcamStreamReady(true);
        };

        const handleError = (e) => {
            console.error("Webcam Init Debug: Video element error (Capture tab):", e);
            setWebcamError("Video playback error. Please try restarting webcam.");
            setIsWebcamStreamReady(false);
            if (currentStream) {
                currentStream.getTracks().forEach(track => track.stop());
                setStream(null);
            }
        };

        videoRef.current.addEventListener('canplay', handleCanPlay);
        videoRef.current.addEventListener('error', handleError);

        if (videoRef.current.readyState >= 3) {
            handleCanPlay();
        }

      } catch (err) {
        console.error('Webcam Init Debug: Error accessing webcam in useEffect (Capture tab):', err);
        setWebcamError(`Error accessing webcam: ${err.name}. Please ensure camera is available and permissions are granted.`);
        setIsWebcamStreamReady(false);
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
      }
    };

    if (isWebcamPanelOpen) {
        initWebcam();
    }

    return () => {
      console.log('Webcam Init Debug: useEffect cleanup running (Capture tab).');
      if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.removeEventListener('canplay', initWebcam);
        videoRef.current.removeEventListener('error', initWebcam);
      }
      setStream(null);
      setIsWebcamStreamReady(false);
    };
  }, [isWebcamPanelOpen]);

  const handleTakePhoto = useCallback(() => {
    console.log('Photo Capture Debug: Attempting to take photo (Capture tab)...');
    if (videoRef.current && canvasRef.current && isWebcamStreamReady) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (video.videoWidth === 0 || video.videoHeight === 0) {
        console.error('Photo Capture Error: Video dimensions are 0 (Capture tab). Cannot capture image. Current video state:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState
        });
        setWebcamError('Cannot capture photo: Video stream not ready. Please wait a moment for the feed to stabilize and try again.');
        return;
      }

      console.log('Photo Capture Debug: Video dimensions before drawing (Capture tab):', video.videoWidth, 'x', video.videoHeight);

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageDataURL = canvas.toDataURL('image/png');
      setCapturedImage(imageDataURL);
      setPhotoFile(null); // Clear photoFile if webcam is used
      setFileName('No file chosen'); // Clear file name
      console.log('Photo captured (Capture tab)!');
      console.log('Captured image data URL length (Capture tab):', imageDataURL.length);
      console.log('Captured image data URL snippet (Capture tab):', imageDataURL.substring(0, 100) + '...');

      // --- NEW: Stop webcam after image is captured ---
      stopWebcam();

    } else {
      console.log('Photo Capture Debug: videoRef, canvasRef, or webcam is not current/active (Capture tab).');
      if (!isWebcamStreamReady) {
          setWebcamError('Webcam stream is not ready. Click "Use Webcam" and wait for the feed to appear before taking a photo.');
      }
    }
  }, [videoRef, canvasRef, isWebcamStreamReady, stopWebcam]);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setPhotoFile(file);
    setFileName(file ? file.name : 'No file chosen');
    setCapturedImage(null);
    stopWebcam();
    setUploadMessage('');
    setUploadError('');
  };

  const handleCaptureAttendance = async () => {
    setUploadMessage('');
    setUploadError('');

    if (!photoFile && !capturedImage) {
        setUploadError('Please upload a photo or capture one using the webcam.');
        return;
    }

    let fileToUpload = null;
    let fileExtension = '';

    if (photoFile) {
        fileToUpload = photoFile;
        const parts = photoFile.name.split('.');
        if (parts.length > 1) {
            fileExtension = parts.pop().toLowerCase();
        } else {
            fileExtension = 'jpg';
        }
    } else if (capturedImage) {
        fileToUpload = dataURLtoBlob(capturedImage);
        fileExtension = 'png';
    }

    if (!fileToUpload) {
        setUploadError('No valid photo source found for upload.');
        return;
    }

    if (typeof window.AWS === 'undefined' || !window.AWS.config.credentials || !window.AWS.config.credentials.accessKeyId) {
        setUploadError("AWS SDK credentials not configured. Please check Identity Pool setup and ensure AWS SDK script is loaded.");
        console.error("AWS SDK or credentials not ready.");
        return;
    }

    const s3 = new window.AWS.S3(); // Use window.AWS.S3 for global access
    const bucketName = 'attendancef13';
    // Create a unique object key using a timestamp for attendance records
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, ''); // Remove all non-numeric characters for a clean key
    const objectKey = `attendance_${timestamp}.${fileExtension}`;

    const uploadParams = {
      Bucket: bucketName,
      Key: objectKey,
      Body: fileToUpload,
      ContentType: fileToUpload.type || `image/${fileExtension}`,
      ACL: 'private', // Or 'public-read' if you want direct URL access.
    };

    try {
        setUploadMessage('Uploading attendance photo...');
        const data = await s3.upload(uploadParams).promise();
        console.log('Upload successful for Attendance Capture:', data.Location);
        setUploadMessage(`Attendance photo uploaded to S3: ${data.Location}`);
        // In a real application, you might now send data (data.Location, timestamp, etc.) to your backend
        // to record attendance in a database, potentially with facial recognition.

        // Clear form after successful capture and upload
        setPhotoFile(null);
        setFileName('No file chosen');
        setCapturedImage(null);
        setWebcamError(''); // Clear webcam errors
        stopWebcam(); // Ensure webcam is stopped after upload
    } catch (err) {
        console.error('Error uploading photo for Attendance Capture:', err);
        setUploadError(`Failed to upload photo: ${err.message || 'An unknown error occurred.'}`);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-3xl font-bold mb-8 text-gray-900">ATTENDANCE CAPTURE</h2>

      <div className="w-full space-y-6 max-w-md">
        {/* Upload Photo Input */}
        <div>
          <label className="block text-lg font-medium text-gray-700 mb-2">
            Upload Photo :
          </label>
          <div className="flex items-center space-x-2">
            <input
              type="file"
              id="attendancePhotoUpload"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <label
              htmlFor="attendancePhotoUpload"
              className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer shadow-sm text-sm font-medium text-gray-700"
            >
              Choose File
            </label>
            <span className="text-gray-500 text-sm">{fileName}</span>
          </div>
        </div>

        {/* Webcam Controls */}
        <div className="mt-6 flex justify-center space-x-4">
          {!isWebcamPanelOpen ? (
            <button
              onClick={openWebcamPanel}
              className="px-8 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-all duration-300 transform hover:scale-105"
            >
              Use Webcam
            </button>
          ) : (
            <>
              <button
                onClick={handleTakePhoto}
                className={`px-8 py-3 font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105 ${
                  isWebcamStreamReady ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-gray-400 text-gray-700 cursor-not-allowed'
                }`}
                disabled={!isWebcamStreamReady}
              >
                Take Photo
              </button>
            </>
          )}
        </div>

        {/* Webcam Error Message */}
        {webcamError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mt-4" role="alert">
            <strong className="font-bold">Webcam Error! </strong>
            <span className="block sm:inline">{webcamError}</span>
          </div>
        )}

        {/* Upload Error Message Display */}
        {uploadError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mt-4" role="alert">
            <strong className="font-bold">Upload Error! </strong>
            <span className="block sm:inline">{uploadError}</span>
          </div>
        )}

        {/* Upload Success Message Display */}
        {uploadMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg relative mt-4" role="alert">
            <strong className="font-bold">Success! </strong>
            <span className="block sm:inline">{uploadMessage}</span>
          </div>
        )}

        {/* Webcam Feed */}
        {isWebcamPanelOpen && (
          <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-sm italic border-2 border-dashed border-gray-400 mt-6 overflow-hidden">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover rounded-lg"></video>
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          </div>
        )}

        {/* Captured Image Display */}
        {capturedImage && (
          <div className="mt-6 w-full max-w-md">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Captured Photo:</h3>
            <div className="w-full h-64 bg-gray-200 rounded-lg overflow-hidden border-2 border-dashed border-gray-400 flex items-center justify-center">
              <img src={capturedImage} alt="Captured from webcam" className="w-full h-full object-contain rounded-lg" />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-8">
          <button
            onClick={handleCaptureAttendance}
            className="w-full px-6 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-lg hover:bg-blue-700 transition-all duration-300 transform hover:scale-105"
          >
            Capture Attendance
          </button>
        </div>
      </div>
    </div>
  );
};

// Attendance Analytics Component
const AttendanceAnalytics = () => {
  // State for selected date, initialized to current date
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0] // Formats date asYYYY-MM-DD for input type="date"
  );
  const [errorMessage, setErrorMessage] = useState(''); // State for displaying API fetch errors
  const [analyticsData, setAnalyticsData] = useState(null); // State to store fetched analytics data

  // Function to fetch daily analytics
  const handleGetDailyAnalytics = async () => {
    setErrorMessage(''); // Clear previous errors
    setAnalyticsData(null); // Clear previous data
    console.log(`Fetching daily analytics for: ${selectedDate}`);
    try {
      // Placeholder for your actual API Gateway endpoint
      const API_ENDPOINT = 'YOUR_API_GATEWAY_ENDPOINT';
      // Provide a helpful message if the default placeholder is still in use
      if (API_ENDPOINT === 'YOUR_API_GATEWAY_ENDPOINT') {
          setErrorMessage("Error! Failed to fetch analytics: Please replace 'YOUR_API_GATEWAY_ENDPOINT' with your actual API.");
          return;
      }
      // Example fetch call - this will require a live API endpoint to work
      const response = await fetch(`${API_ENDPOINT}/daily?date=${selectedDate}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAnalyticsData(data); // Update state with fetched data
      console.log('Daily Analytics Data:', data);
    } catch (error) {
      setErrorMessage(`Error! Failed to fetch analytics: ${error.message}`);
      console.error('API Error:', error);
    }
  };

  // Function to fetch weekly analytics
  const handleGetWeeklyAnalytics = async () => {
    setErrorMessage(''); // Clear previous errors
    setAnalyticsData(null); // Clear previous data
    console.log(`Fetching weekly analytics for week of: ${selectedDate}`);
    try {
      // Placeholder for your actual API Gateway endpoint
      const API_ENDPOINT = 'YOUR_API_GATEWAY_ENDPOINT';
       if (API_ENDPOINT === 'YOUR_API_GATEWAY_ENDPOINT') {
          setErrorMessage("Error! Failed to fetch analytics: Please replace 'YOUR_API_GATEWAY_ENDPOINT' with your actual API.");
          return;
      }
      // Example fetch call
      const response = await fetch(`${API_ENDPOINT}/weekly?date=${selectedDate}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setAnalyticsData(data); // Update state with fetched data
      console.log('Weekly Analytics Data:', data);
    } catch (error) {
      setErrorMessage(`Error! Failed to fetch analytics: ${error.message}`);
      console.error('API Error:', error);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <h2 className="text-3xl font-bold mb-8 text-gray-900">Attendance Analytics Dashboard</h2>

      <div className="w-full space-y-6 max-w-xl">
        {/* Date Selection Input */}
        <div>
          <label htmlFor="selectDate" className="block text-lg font-medium text-gray-700 mb-2">
            Select Date :
          </label>
          <input
            type="date"
            id="selectDate"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {/* Analytics Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4 mt-6">
          <button
            onClick={handleGetDailyAnalytics}
            className="flex-1 px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-all duration-300 transform hover:scale-105"
          >
            Get Daily Analytics
          </button>
          <button
            onClick={handleGetWeeklyAnalytics}
            className="flex-1 px-8 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-all duration-300 transform hover:scale-105"
          >
            Get Weekly Analytics
          </button>
        </div>

        {/* Error Message Display */}
        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative mt-4" role="alert">
            <strong className="font-bold">Error! </strong>
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        {/* Placeholder for Analytics Data Display */}
        {analyticsData && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg relative mt-6">
            <strong className="font-bold">Analytics Data:</strong>
            {/* Display fetched analytics data in a pre-formatted block */}
            <pre className="mt-2 text-sm whitespace-pre-wrap">{JSON.stringify(analyticsData, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
