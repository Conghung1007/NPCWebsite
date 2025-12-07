import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Download, XCircle } from "lucide-react";
import { type ExamAttempt, type Exam, type User } from "@shared/schema";
import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import logoBackground from "@assets/image_1765066723975.png";

interface CertificatePageProps {
  attemptId: string;
}

export function CertificatePage({ attemptId }: CertificatePageProps) {
  const [, setLocation] = useLocation();
  const certificateRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: attempt, isLoading: attemptLoading } = useQuery<ExamAttempt>({
    queryKey: [`/api/exam-attempts/${attemptId}`],
    retry: false,
  });

  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: [`/api/exams/${attempt?.examId}`],
    enabled: !!attempt,
    retry: false,
  });

  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const { data: questionsWithAnswers = [], isLoading: questionsLoading } = useQuery<any[]>({
    queryKey: [`/api/exam-attempts/${attemptId}/details`],
    retry: false,
  });

  if (attemptLoading || examLoading || userLoading || questionsLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Đang tải chứng nhận...</p>
        </div>
      </div>
    );
  }

  if (!attempt || !exam || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600">Không tìm thấy thông tin chứng nhận</p>
          <Button onClick={() => setLocation("/online-exam")} className="mt-4">
            Về trang chủ
          </Button>
        </div>
      </div>
    );
  }

  const useSections = (exam as any).sections && Array.isArray((exam as any).sections) && (exam as any).sections.length > 0;

  const calculateTotalPoints = (item: any) => {
    let total = 0;
    total += parseFloat(item.question.points) || 1;
    if (item.question.subQuestions && Array.isArray(item.question.subQuestions)) {
      item.question.subQuestions.forEach((sub: any) => {
        total += parseFloat(sub.points) || 1;
      });
    }
    return total;
  };

  const calculateEarnedPoints = (item: any) => {
    let earned = 0;
    if (String(item.userAnswer) === String(item.question.correctAnswer)) {
      const points = parseFloat(item.question.points) || 1;
      earned += points;
    }
    if (item.question.subQuestions && Array.isArray(item.question.subQuestions)) {
      item.question.subQuestions.forEach((sub: any) => {
        if (String(sub.userAnswer) === String(sub.correctAnswer)) {
          const points = parseFloat(sub.points) || 1;
          earned += points;
        }
      });
    }
    return earned;
  };

  let sectionGroups: any[] = [];
  
  if (useSections) {
    sectionGroups = (exam as any).sections.map((section: any) => {
      let sectionQuestionIds: string[] = [];
      
      if (section.questionSets && Array.isArray(section.questionSets)) {
        sectionQuestionIds = section.questionSets.flatMap((qs: any) => 
          qs.questionIds || []
        );
      } else if (section.questionIds) {
        sectionQuestionIds = section.questionIds;
      }
      
      const sectionQuestions = questionsWithAnswers.filter(item => 
        sectionQuestionIds.includes(item.question.id)
      );
      
      let sectionTotalPoints = 0;
      let sectionEarnedPoints = 0;
      
      sectionQuestions.forEach(item => {
        sectionTotalPoints += calculateTotalPoints(item);
        sectionEarnedPoints += calculateEarnedPoints(item);
      });
      
      const sectionPassingScore = section.passingScore;
      const sectionPassed = (sectionPassingScore == null || sectionPassingScore === undefined) ? true : sectionEarnedPoints >= sectionPassingScore;
      
      return {
        title: section.sectionName || section.type,
        passingScore: sectionPassingScore,
        totalPoints: sectionTotalPoints,
        earnedPoints: sectionEarnedPoints,
        passed: sectionPassed
      };
    });
  }

  const totalPoints = sectionGroups.reduce((sum, section) => sum + section.totalPoints, 0) ||
    questionsWithAnswers.reduce((sum, item) => sum + calculateTotalPoints(item), 0);
  const earnedPoints = sectionGroups.reduce((sum, section) => sum + section.earnedPoints, 0) ||
    questionsWithAnswers.reduce((sum, item) => sum + calculateEarnedPoints(item), 0);
  
  const examPassingScore = (exam as any).passingScore;
  const allSectionsPassed = sectionGroups.length === 0 || sectionGroups.every(section => section.passed);
  
  let examPassed = false;
  
  if (!allSectionsPassed) {
    examPassed = false;
  } else if (examPassingScore != null && examPassingScore > 0 && earnedPoints < examPassingScore) {
    examPassed = false;
  } else {
    examPassed = true;
  }

  if (!examPassed) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Không có chứng nhận</h2>
          <p className="text-gray-600 mb-6">
            Chứng nhận chỉ được cấp cho các bài thi có kết quả đạt. 
            Bạn chưa đạt yêu cầu của bài thi này.
          </p>
          <Button onClick={() => window.history.back()} data-testid="button-back-no-certificate">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  const examDate = new Date(attempt.completedAt);
  const formattedDate = examDate.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  const japaneseDate = `${examDate.getFullYear()}年${examDate.getMonth() + 1}月${examDate.getDate()}日`;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!certificateRef.current) return;
    
    setIsDownloading(true);
    try {
      const element = certificateRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;
      
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      const fileName = `certificate_${user.fullName || user.username}_${exam.title.replace(/\s+/g, '_')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="print:hidden py-4 px-6 bg-white shadow-sm flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          data-testid="button-back-certificate"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>
        <div className="flex gap-2">
          <Button 
            onClick={handleDownloadPDF} 
            disabled={isDownloading}
            variant="outline"
            data-testid="button-download-certificate-pdf"
          >
            <Download className="w-4 h-4 mr-2" />
            {isDownloading ? "Đang tải..." : "Tải PDF"}
          </Button>
          <Button onClick={handlePrint} data-testid="button-print-certificate">
            <Printer className="w-4 h-4 mr-2" />
            In chứng nhận
          </Button>
        </div>
      </div>

      <div className="flex justify-center py-8 print:py-0">
        <div 
          ref={certificateRef}
          className="bg-white shadow-lg print:shadow-none w-[210mm] min-h-[297mm] p-6 print:p-4 relative" 
          style={{ fontFamily: "'Times New Roman', serif" }}
        >
          <div 
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ zIndex: 0 }}
          >
            <img 
              src={logoBackground} 
              alt="" 
              className="w-[300px] h-[300px] object-contain"
              style={{ opacity: 0.08 }}
            />
          </div>
          <div className="border-4 border-green-700 p-8 h-full m-4 relative" style={{ zIndex: 1 }}>
            <div className="text-center space-y-6">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-green-700 mb-2">
                  TRI NHAN ONLINE JAPANESE - LANGUAGE PROFICIENCY TEST
                </h1>
                <h2 className="text-xl font-semibold text-green-600 mb-2">
                  CERTIFICATE OF RESULT AND SCORES
                </h2>
                <p className="text-green-700 font-semibold text-lg">
                  TRI NHAN ONLINE ⽇本語能⼒試験
                </p>
                <p className="text-green-600 text-base">
                  確定結果及び成績に関する証明書。
                </p>
              </div>

              <div className="py-6 border-y-2 border-green-200">
                <h3 className="text-3xl font-bold text-green-800 mb-4">
                  {exam.title}
                </h3>
              </div>

              <div className="my-8 text-base leading-relaxed">
                <p className="mb-4">
                  {japaneseDate}に、TRI NHAN が実施した⽇本語能⼒試験に関し、確定結果及び成績を次のとおり証明します。
                </p>
                <p>
                  This is to certify the result and the score of Japanese - Language Proficiency Test given on<br />
                  <strong>{formattedDate}</strong>, jointly administered by Trí Nhân Online
                </p>
              </div>

              <div className="my-10 py-6 bg-green-50 rounded-lg">
                <table className="w-full text-center">
                  <tbody>
                    <tr className="border-b border-green-200">
                      <td className="py-3 px-4 font-semibold text-green-700 w-1/3">⽒名 / Name:</td>
                      <td className="py-3 px-4 text-xl font-bold text-green-900">
                        {user.fullName || user.username}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-green-700">結果 / Result:</td>
                      <td className="py-3 px-4">
                        <span className="text-xl font-bold text-green-600">
                          Đạt / Pass
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-16 pt-8 border-t-2 border-green-200">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">主催者 / Administrator</p>
                  <p className="text-lg font-bold text-green-700">LÒ LUYỆN NHẬT NGỮ TRÍ NHÂN</p>
                  <p className="text-sm text-gray-600 mt-2">
                    354 Lê Quang Định, phường Bình Lợi Trung, TP.HCM
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default CertificatePage;
