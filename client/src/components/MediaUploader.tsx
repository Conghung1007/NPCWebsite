import { useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import type { UploadResult } from "@uppy/core";
import { Button } from "@/components/ui/button";

interface MediaUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  allowedFileTypes?: string[];
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A media upload component that handles images and videos for articles.
 * 
 * Features:
 * - Supports images (jpg, png, gif, webp) and videos (mp4, webm, mov)
 * - Provides a modal interface for file selection and upload
 * - Shows upload progress and status
 * - Handles file size and type validation
 * 
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed (default: 5)
 * @param props.maxFileSize - Maximum file size in bytes (default: 50MB)
 * @param props.allowedFileTypes - Array of allowed MIME types
 * @param props.onGetUploadParameters - Function to get upload URL from backend
 * @param props.onComplete - Callback when upload completes
 * @param props.buttonClassName - CSS class for the trigger button
 * @param props.children - Button content
 */
export function MediaUploader({
  maxNumberOfFiles = 5,
  maxFileSize = 52428800, // 50MB default
  allowedFileTypes = [
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime' // .mov files
  ],
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
}: MediaUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
        allowedFileTypes,
      },
      autoProceed: false,
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: onGetUploadParameters,
      })
      .on("complete", (result) => {
        onComplete?.(result);
        setShowModal(false);
      })
  );

  return (
    <div>
      <Button onClick={() => setShowModal(true)} className={buttonClassName}>
        {children}
      </Button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
        note="Hỗ trợ hình ảnh (JPG, PNG, GIF, WebP) và video (MP4, WebM, MOV) tối đa 50MB"
        locale={{
          strings: {
            dropPasteFiles: "Kéo thả file hoặc %{browseFiles}",
            browseFiles: "chọn file"
          }
        }}
      />
    </div>
  );
}