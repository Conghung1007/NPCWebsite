import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { HeroSection } from "@/components/ui/hero-section";
import { ServiceCard } from "@/components/ui/service-card";
import { Button } from "@/components/ui/button";
import { EditableText } from "@/components/ui/editable-text";
import { Card, CardContent } from "@/components/ui/card";
import { ArticleSection } from "@/components/ArticleSection";
import { ImageManager } from "@/components/ui/image-manager";
import { useAuth } from "@/hooks/useAuth";
import { 
  Plane, 
  Briefcase, 
  GraduationCap, 
  Home,
  CheckCircle,
  MessageCircle,
  FileText,
  Search,
  Send,
  Award,
  Edit,
  Check,
  X
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function VisaServices() {
  const [, setLocation] = useLocation();
  const { user, hasImageEditPermission } = useAuth();
  const hasEditPermission = user?.role === 'manager' || user?.role === 'admin';
  const [heroImage, setHeroImage] = useState("https://images.unsplash.com/photo-1578662996442-48f60103fc96?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&h=1080");
  const [consultationImage, setConsultationImage] = useState("https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600");
  const [showHeroImageManager, setShowHeroImageManager] = useState(false);
  const [showConsultationImageManager, setShowConsultationImageManager] = useState(false);
  
  // Text editing states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  // Text editing handlers
  const handleEditStart = (fieldName: string, currentValue: string) => {
    setEditingField(fieldName);
    setEditValues({ ...editValues, [fieldName]: currentValue });
  };

  const handleEditSave = (fieldName: string, value: string) => {
    setEditValues({ ...editValues, [fieldName]: value });
    setEditingField(null);
  };

  const handleEditCancel = () => {
    setEditingField(null);
    setEditValues({});
  };

  // Handle document text updates
  const handleDocumentUpdate = (index: number, newValue: string) => {
    const updatedDocs = [...requiredDocuments];
    updatedDocs[index] = newValue;
    setRequiredDocuments(updatedDocs);
  };

  // Handle FAQ updates
  const handleFaqQuestionUpdate = (index: number, newValue: string) => {
    const updatedFaqs = [...faqs];
    updatedFaqs[index] = { ...updatedFaqs[index], question: newValue };
    setFaqs(updatedFaqs);
  };

  const handleFaqAnswerUpdate = (index: number, newValue: string) => {
    const updatedFaqs = [...faqs];
    updatedFaqs[index] = { ...updatedFaqs[index], answer: newValue };
    setFaqs(updatedFaqs);
  };

  useEffect(() => {
    document.title = "Dịch Vụ Xin Thị Thực - N&P Company";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Dịch vụ xin thị thực chuyên nghiệp với tỷ lệ thành công 98% cho hơn 50 quốc gia. Hỗ trợ visa du lịch, công tác, sinh viên, định cư.');
    }
  }, []);

  const visaTypes = [
    {
      icon: <Plane className="h-6 w-6 text-primary" />,
      title: "Visa Du Lịch",
      description: "Thăm quan, nghỉ dưỡng"
    },
    {
      icon: <Briefcase className="h-6 w-6 text-secondary" />,
      title: "Visa Công Tác", 
      description: "Họp hội nghị, hợp tác"
    },
    {
      icon: <GraduationCap className="h-6 w-6 text-accent" />,
      title: "Visa Du Học",
      description: "Học tập, nghiên cứu"
    },
    {
      icon: <Home className="h-6 w-6 text-primary" />,
      title: "Visa Định Cư",
      description: "Sinh sống lâu dài"
    }
  ];

  const processSteps = [
    {
      number: "1",
      title: "Tư Vấn",
      description: "Tư vấn miễn phí về loại visa phù hợp",
      icon: <MessageCircle className="h-6 w-6" />
    },
    {
      number: "2", 
      title: "Chuẩn Bị",
      description: "Hướng dẫn chuẩn bị hồ sơ đầy đủ",
      icon: <FileText className="h-6 w-6" />
    },
    {
      number: "3",
      title: "Kiểm Tra",
      description: "Rà soát kỹ lưỡng hồ sơ trước khi nộp",
      icon: <Search className="h-6 w-6" />
    },
    {
      number: "4",
      title: "Nộp Đơn", 
      description: "Nộp hồ sơ và theo dõi tiến độ",
      icon: <Send className="h-6 w-6" />
    },
    {
      number: "5",
      title: "Nhận Kết Quả",
      description: "Nhận visa và hướng dẫn sử dụng",
      icon: <Award className="h-6 w-6" />
    }
  ];

  const [requiredDocuments, setRequiredDocuments] = useState([
    "Hộ chiếu còn hạn tối thiểu 6 tháng",
    "Đơn xin visa đã điền đầy đủ", 
    "Ảnh 4x6 cm nền trắng (theo tiêu chuẩn)",
    "Chứng minh tài chính",
    "Bảo hiểm du lịch (tùy quốc gia)",
    "Giấy tờ khác theo yêu cầu riêng"
  ]);

  const [faqs, setFaqs] = useState([
    {
      question: "Thời gian xử lý visa là bao lâu?",
      answer: "Thông thường từ 5-15 ngày làm việc tùy thuộc vào quốc gia và loại visa. Chúng tôi sẽ thông báo chính xác thời gian cho từng trường hợp cụ thể."
    },
    {
      question: "Chi phí dịch vụ bao gồm những gì?",
      answer: "Chi phí bao gồm tư vấn, kiểm tra hồ sơ, nộp đơn và theo dõi kết quả. Lệ phí lãnh sự được tính riêng theo quy định của từng quốc gia."
    },
    {
      question: "Nếu bị từ chối có được hoàn phí?",
      answer: "Lệ phí lãnh sự không hoàn lại theo quy định quốc tế. Chi phí dịch vụ có chính sách hoàn tiền theo cam kết trong hợp đồng."
    },
    {
      question: "Tỷ lệ thành công của N&P như thế nào?",
      answer: "N&P có tỷ lệ thành công 98% nhờ quy trình chuyên nghiệp và kinh nghiệm nhiều năm. Chúng tôi cam kết hỗ trợ tối đa để hồ sơ của bạn được chấp thuận."
    }
  ]);

  const handleConsultation = () => {
    setLocation("/contact");
  };

  return (
    <div>
      <HeroSection
        title="Dịch vụ xin thị thực"
        subtitle=""
        description="Chuyên gia hàng đầu về dịch vụ xin visa với tỷ lệ thành công 98% cho hơn 50 quốc gia trên thế giới"
        backgroundImage={heroImage}
        allowImageEdit={hasImageEditPermission}
        onImageUpdate={setHeroImage}
        primaryAction={{
          text: "Nhận tư vấn miễn phí",
          onClick: handleConsultation
        }}
        secondaryAction={{
          text: "Nộp đơn ngay",
          onClick: handleConsultation
        }}
      />
      {/* Visa Types & Countries */}
      <section className="py-20 bg-white pt-[60px] pb-[60px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 mb-16">
            <div className="relative">
              <img 
                src={consultationImage} 
                alt="Professional visa processing office" 
                className="rounded-xl shadow-lg w-full h-auto" 
              />
              {hasImageEditPermission && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConsultationImageManager(true)}
                  className="absolute top-4 right-4 bg-white/80 hover:bg-white/90 text-gray-700"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Cập nhật ảnh
                </Button>
              )}
              <ImageManager
                isOpen={showConsultationImageManager}
                onClose={() => setShowConsultationImageManager(false)}
                onImageUpdate={setConsultationImage}
                imageType="visa-consultation"
                altText="Visa consultation image"
              />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-6">
                <EditableText 
                  fieldName="visa-types-support-title"
                  text="Các loại thị thực chúng tôi hỗ trợ"
                  className="text-2xl font-bold text-foreground"
                  showEditButton={false}
                  editingField={null}
                  editValues={{}}
                  onEditStart={() => {}}
                  onEditSave={() => {}}
                  onEditCancel={() => {}}
                />
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-8">
                {visaTypes.map((type, index) => (
                  <div key={index} className="flex items-center p-4 bg-neutral rounded-lg">
                    {type.icon}
                    <div className="ml-3">
                      <span className="font-medium text-foreground">
                        <EditableText 
                          fieldName={`visa-type-${index}-title`}
                          text={type.title}
                          className="font-medium text-foreground"
                          showEditButton={false}
                          editingField={null}
                          editValues={{}}
                          onEditStart={() => {}}
                          onEditSave={() => {}}
                          onEditCancel={() => {}}
                        />
                      </span>
                      <p className="text-sm text-muted-foreground">
                        <EditableText 
                          fieldName={`visa-type-${index}-description`}
                          text={type.description}
                          className="text-sm text-muted-foreground"
                          showEditButton={false}
                          editingField={null}
                          editValues={{}}
                          onEditStart={() => {}}
                          onEditSave={() => {}}
                          onEditCancel={() => {}}
                        />
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              
              <h4 className="text-lg font-semibold text-foreground mb-4">
                <EditableText 
                  fieldName="visa-countries-title"
                  text="Quốc gia chuyên môn"
                  className="text-lg font-semibold text-foreground"
                  showEditButton={false}
                  editingField={null}
                  editValues={{}}
                  onEditStart={() => {}}
                  onEditSave={() => {}}
                  onEditCancel={() => {}}
                />
              </h4>
              <div className="flex flex-wrap gap-2 mb-6">
                {["Nhật Bản", "Hàn Quốc", "Mỹ", "Canada", "Úc", "Anh", "Đức", "+40 quốc gia"].map((country, index) => (
                  <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                    {country}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Process Steps */}
      <section className="py-20 bg-neutral pt-[30px] pb-[30px]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h3 className="text-2xl font-bold text-foreground text-center mb-12">
            <EditableText 
              fieldName="visa-process-title"
              text={editValues["visa-process-title"] || "Quy trình xin thị thực"}
              className="text-2xl font-bold text-foreground"
              showEditButton={hasEditPermission}
              editingField={editingField}
              editValues={editValues}
              onEditStart={handleEditStart}
              onEditSave={handleEditSave}
              onEditCancel={handleEditCancel}
            />
          </h3>
          <div className="grid md:grid-cols-5 gap-8">
            {processSteps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold text-xl">{step.number}</span>
                </div>
                <h4 className="font-semibold text-foreground mb-2">{step.title}</h4>
                <p className="text-muted-foreground text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/* Required Documents & FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <Card>
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-foreground mb-6">
                  <EditableText 
                    fieldName="visa-documents-title"
                    text={editValues["visa-documents-title"] || "Hồ Sơ Bắt Buộc"}
                    className="text-xl font-bold text-foreground"
                    showEditButton={false}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </h3>
                <ul className="space-y-3">
                  {requiredDocuments.map((doc, index) => (
                    <li key={index} className="flex items-start">
                      <CheckCircle className="h-5 w-5 text-secondary mt-1 mr-3 flex-shrink-0" />
                      <div className="text-muted-foreground flex-1">
                        <EditableText
                          fieldName={`visa-document-${index}`}
                          text={doc}
                          className="text-muted-foreground"
                          showEditButton={hasEditPermission}
                          editingField={editingField}
                          editValues={editValues}
                          onEditStart={handleEditStart}
                          onEditSave={(fieldName, value) => {
                            handleDocumentUpdate(index, value);
                            handleEditSave(fieldName, value);
                          }}
                          onEditCancel={handleEditCancel}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-8">
                <h3 className="text-xl font-bold text-foreground mb-6">
                  <EditableText 
                    fieldName="visa-faq-title"
                    text={editValues["visa-faq-title"] || "Câu Hỏi Thường Gặp"}
                    className="text-xl font-bold text-foreground"
                    showEditButton={false}
                    editingField={editingField}
                    editValues={editValues}
                    onEditStart={handleEditStart}
                    onEditSave={handleEditSave}
                    onEditCancel={handleEditCancel}
                  />
                </h3>
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`item-${index}`} className="group">
                      <AccordionTrigger className="text-left">
                        <div className="flex items-center justify-between w-full">
                          {editingField === `faq-question-${index}` ? (
                            <div className="flex-1 flex items-center gap-2">
                              <input
                                type="text"
                                value={editValues[`faq-question-${index}`] || faq.question}
                                onChange={(e) => setEditValues({...editValues, [`faq-question-${index}`]: e.target.value})}
                                className="flex-1 px-2 py-1 border rounded text-sm"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newValue = editValues[`faq-question-${index}`] || faq.question;
                                  handleFaqQuestionUpdate(index, newValue);
                                  handleEditSave(`faq-question-${index}`, newValue);
                                }}
                                className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded cursor-pointer"
                              >
                                <Check className="h-3 w-3" />
                              </div>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditCancel();
                                }}
                                className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                              >
                                <X className="h-3 w-3" />
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className="flex-1">{faq.question}</span>
                              {hasEditPermission && (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditStart(`faq-question-${index}`, faq.question);
                                  }}
                                  className="ml-2 p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-100 rounded cursor-pointer"
                                >
                                  <Edit className="h-3 w-3" />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="pt-2 relative group">
                          {editingField === `faq-answer-${index}` ? (
                            <div className="flex flex-col gap-2">
                              <textarea
                                value={editValues[`faq-answer-${index}`] || faq.answer}
                                onChange={(e) => setEditValues({...editValues, [`faq-answer-${index}`]: e.target.value})}
                                className="w-full px-3 py-2 border rounded text-muted-foreground resize-none"
                                rows={4}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <div
                                  onClick={() => {
                                    const newValue = editValues[`faq-answer-${index}`] || faq.answer;
                                    handleFaqAnswerUpdate(index, newValue);
                                    handleEditSave(`faq-answer-${index}`, newValue);
                                  }}
                                  className="px-3 py-1 bg-green-600 text-white rounded cursor-pointer hover:bg-green-700 flex items-center gap-1"
                                >
                                  <Check className="h-3 w-3" />
                                  Lưu
                                </div>
                                <div
                                  onClick={handleEditCancel}
                                  className="px-3 py-1 bg-red-600 text-white rounded cursor-pointer hover:bg-red-700 flex items-center gap-1"
                                >
                                  <X className="h-3 w-3" />
                                  Hủy
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="text-muted-foreground">{faq.answer}</div>
                              {hasEditPermission && (
                                <div
                                  onClick={() => handleEditStart(`faq-answer-${index}`, faq.answer)}
                                  className="inline-flex items-center gap-1 mt-2 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Edit className="h-3 w-3" />
                                  Chỉnh sửa
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </div>

        </div>
      </section>
      {/* Articles Section */}
      <ArticleSection 
        category="visa-services"
        title="Thông tin về dịch vụ visa"
        description="Thông tin hữu ích và cập nhật về thủ tục xin visa các quốc gia"
      />
    </div>
  );
}
