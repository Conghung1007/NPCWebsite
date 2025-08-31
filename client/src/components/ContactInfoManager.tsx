import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Save, X, MapPin, Phone, Mail, Clock } from "lucide-react";
import { useContactInfo, useCreateContactInfo, useUpdateContactInfo, useDeleteContactInfo, useSeedContactInfo } from "@/hooks/useContactInfo";
import { ContactInfo, InsertContactInfo } from "@shared/schema";

export function ContactInfoManager() {
  const { toast } = useToast();
  const { data: contactInfos = [], isLoading } = useContactInfo();
  const createContactInfo = useCreateContactInfo();
  const updateContactInfo = useUpdateContactInfo();
  const deleteContactInfo = useDeleteContactInfo();
  const seedContactInfo = useSeedContactInfo();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; contactInfo: ContactInfo | null }>({
    isOpen: false,
    contactInfo: null
  });
  
  const [formData, setFormData] = useState<Partial<InsertContactInfo>>({
    type: "",
    title: "",
    content: [""],
    mapUrl: "",
    displayOrder: 0,
    isActive: true
  });

  const contactTypes = [
    { value: "main_office", label: "Văn phòng chính", icon: MapPin },
    { value: "hotline", label: "Hotline", icon: Phone },
    { value: "email", label: "Email", icon: Mail },
    { value: "business_hours", label: "Giờ hoạt động", icon: Clock },
  ];

  const getTypeIcon = (type: string) => {
    const typeConfig = contactTypes.find(t => t.value === type);
    const Icon = typeConfig?.icon || MapPin;
    return <Icon className="w-4 h-4" />;
  };

  const getTypeLabel = (type: string) => {
    const typeConfig = contactTypes.find(t => t.value === type);
    return typeConfig?.label || type;
  };

  const handleAddContent = () => {
    setFormData(prev => ({
      ...prev,
      content: [...(prev.content || []), ""]
    }));
  };

  const handleRemoveContent = (index: number) => {
    setFormData(prev => ({
      ...prev,
      content: prev.content?.filter((_, i) => i !== index) || []
    }));
  };

  const handleContentChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      content: prev.content?.map((item, i) => i === index ? value : item) || []
    }));
  };

  const handleSave = async () => {
    if (!formData.type || !formData.title || !formData.content?.some(c => c.trim())) {
      toast({
        title: "Lỗi",
        description: "Vui lòng điền đầy đủ thông tin",
        variant: "destructive",
      });
      return;
    }

    const cleanedContent = formData.content?.filter(c => c.trim()) || [];
    
    try {
      if (editingId) {
        await updateContactInfo.mutateAsync({
          id: editingId,
          data: {
            ...formData,
            content: cleanedContent
          }
        });
        toast({
          title: "Thành công",
          description: "Đã cập nhật thông tin liên hệ",
        });
      } else {
        await createContactInfo.mutateAsync({
          ...formData,
          content: cleanedContent
        } as InsertContactInfo);
        toast({
          title: "Thành công",
          description: "Đã thêm thông tin liên hệ mới",
        });
      }
      
      handleCancel();
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể lưu thông tin liên hệ",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (contactInfo: ContactInfo) => {
    setFormData({
      type: contactInfo.type,
      title: contactInfo.title,
      content: [...contactInfo.content],
      mapUrl: contactInfo.mapUrl || "",
      displayOrder: contactInfo.displayOrder || 0,
      isActive: contactInfo.isActive
    });
    setEditingId(contactInfo.id);
    setIsAdding(true);
  };

  const handleDelete = (contactInfo: ContactInfo) => {
    setDeleteConfirm({ isOpen: true, contactInfo });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.contactInfo) return;
    
    try {
      await deleteContactInfo.mutateAsync(deleteConfirm.contactInfo.id);
      toast({
        title: "Thành công",
        description: "Đã xóa thông tin liên hệ",
      });
      setDeleteConfirm({ isOpen: false, contactInfo: null });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể xóa thông tin liên hệ",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({
      type: "",
      title: "",
      content: [""],
      mapUrl: "",
      displayOrder: 0,
      isActive: true
    });
  };

  const handleSeedData = async () => {
    try {
      await seedContactInfo.mutateAsync();
      toast({
        title: "Thành công",
        description: "Đã tạo dữ liệu mẫu thông tin liên hệ",
      });
    } catch (error) {
      toast({
        title: "Lỗi",
        description: "Không thể tạo dữ liệu mẫu",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Quản lý thông tin liên hệ
              </CardTitle>
              <CardDescription>
                Quản lý thông tin liên hệ hiển thị trên website
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {contactInfos.length === 0 && (
                <Button 
                  onClick={handleSeedData}
                  disabled={seedContactInfo.isPending}
                  variant="outline"
                >
                  Tạo dữ liệu mặc định
                </Button>
              )}
              {!isAdding && (
                <Button onClick={() => setIsAdding(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm thông tin
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isAdding && (
            <div className="mb-6 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium mb-4">
                {editingId ? "Chỉnh sửa thông tin liên hệ" : "Thêm thông tin liên hệ mới"}
              </h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Loại thông tin</Label>
                    <select
                      id="type"
                      value={formData.type}
                      onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Chọn loại thông tin</option>
                      {contactTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="title">Tiêu đề</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Nhập tiêu đề"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Nội dung</Label>
                  <div className="space-y-2 mt-2">
                    {formData.content?.map((content, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          value={content}
                          onChange={(e) => handleContentChange(index, e.target.value)}
                          placeholder="Nhập nội dung"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleRemoveContent(index)}
                          disabled={formData.content?.length === 1}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddContent}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Thêm dòng
                    </Button>
                  </div>
                </div>

                {formData.type === "main_office" && (
                  <div>
                    <Label htmlFor="mapUrl">Link bản đồ Google Maps (Tùy chọn)</Label>
                    <Input
                      id="mapUrl"
                      value={formData.mapUrl || ""}
                      onChange={(e) => setFormData(prev => ({ ...prev, mapUrl: e.target.value }))}
                      placeholder="https://www.google.com/maps/embed?pb=..."
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Lấy link embed từ Google Maps: Share → Embed a map → Copy HTML
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="displayOrder">Thứ tự hiển thị</Label>
                    <Input
                      id="displayOrder"
                      type="number"
                      value={formData.displayOrder || 0}
                      onChange={(e) => setFormData(prev => ({ ...prev, displayOrder: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div className="flex items-center space-x-2 mt-6">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={formData.isActive || false}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="rounded"
                    />
                    <Label htmlFor="isActive">Hiển thị</Label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSave}
                    disabled={createContactInfo.isPending || updateContactInfo.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editingId ? "Cập nhật" : "Thêm mới"}
                  </Button>
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="w-4 h-4 mr-2" />
                    Hủy
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : contactInfos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Chưa có thông tin liên hệ nào</p>
              <p className="text-sm">Nhấn "Tạo dữ liệu mặc định" để thêm thông tin mẫu</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loại</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Nội dung</TableHead>
                  <TableHead>Bản đồ</TableHead>
                  <TableHead>Thứ tự</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactInfos.map((contactInfo) => (
                  <TableRow key={contactInfo.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(contactInfo.type)}
                        {getTypeLabel(contactInfo.type)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {contactInfo.title}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {contactInfo.content.map((item, index) => (
                          <div key={index} className="text-sm">{item}</div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {contactInfo.mapUrl ? (
                        <span className="text-sm text-green-600">✓ Có bản đồ</span>
                      ) : (
                        <span className="text-sm text-gray-400">Không có</span>
                      )}
                    </TableCell>
                    <TableCell>{contactInfo.displayOrder}</TableCell>
                    <TableCell>
                      <Badge variant={contactInfo.isActive ? "default" : "secondary"}>
                        {contactInfo.isActive ? "Hiển thị" : "Ẩn"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(contactInfo)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(contactInfo)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.isOpen} onOpenChange={(open) => !open && setDeleteConfirm({ isOpen: false, contactInfo: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xác nhận xóa</DialogTitle>
            <DialogDescription>
              Bạn có chắc chắn muốn xóa thông tin liên hệ "{deleteConfirm.contactInfo?.title}" không?
              <br />
              <span className="text-red-600 font-medium">Hành động này không thể hoàn tác.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirm({ isOpen: false, contactInfo: null })}
            >
              Hủy
            </Button>
            <Button 
              variant="destructive" 
              onClick={confirmDelete}
              disabled={deleteContactInfo.isPending}
            >
              Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}