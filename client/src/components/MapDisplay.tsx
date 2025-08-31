import { useContactInfo } from "@/hooks/useContactInfo";

interface MapDisplayProps {
  className?: string;
}

export function MapDisplay({ className = "" }: MapDisplayProps) {
  const { data: contactInfos = [] } = useContactInfo();
  
  const officeInfo = contactInfos.find(info => info.type === "main_office" && info.isActive);
  
  if (!officeInfo?.mapUrl) {
    return (
      <div className={`bg-gray-100 rounded-lg p-8 text-center ${className}`}>
        <p className="text-gray-500">Bản đồ văn phòng chưa được cấu hình</p>
      </div>
    );
  }

  // Extract embed URL from iframe src or use direct URL
  const getEmbedUrl = (url: string) => {
    // If it's already an embed URL, return it
    if (url.includes('google.com/maps/embed')) {
      return url;
    }
    
    // If it's an iframe HTML, extract the src
    const iframeSrcMatch = url.match(/src="([^"]*)"/) || url.match(/src='([^']*)'/);
    if (iframeSrcMatch) {
      return iframeSrcMatch[1];
    }
    
    return url;
  };

  const embedUrl = getEmbedUrl(officeInfo.mapUrl);

  return (
    <div className={`rounded-lg overflow-hidden shadow-md ${className}`}>
      <iframe
        src={embedUrl}
        width="100%"
        height="400"
        style={{ border: 0 }}
        allowFullScreen={true}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        title={`Bản đồ - ${officeInfo.title}`}
        className="w-full"
      ></iframe>
    </div>
  );
}