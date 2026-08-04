# EditableText Component Usage Guidelines

## Phương thức thống nhất cho EditableText

Để tránh lỗi "editingField is not defined" và đảm bảo tính nhất quán, tất cả EditableText components nên được sử dụng theo một trong hai cách:

### Cách 1: Chế độ chỉ đọc (Recommended)
```jsx
<EditableText 
  fieldName="unique-field-name"
  text="Nội dung hiển thị"
  className="your-css-classes"
  showEditButton={false}
  editingField={null}
  editValues={{}}
  onEditStart={() => {}}
  onEditSave={() => {}}
  onEditCancel={() => {}}
/>
```

### Cách 2: Chế độ có thể chỉnh sửa (chỉ cho trang có state quản lý)
```jsx
// Trong component, cần có các state sau:
const [editingField, setEditingField] = useState(null);
const [editValues, setEditValues] = useState({});

const handleEditStart = (fieldName, currentValue) => {
  setEditingField(fieldName);
  setEditValues({ ...editValues, [fieldName]: currentValue });
};

const handleEditSave = (fieldName, value) => {
  // Xử lý logic lưu
  console.log(`Saving field ${fieldName} with value:`, value);
  setEditValues({ ...editValues, [fieldName]: value });
  setEditingField(null);
};

const handleEditCancel = () => {
  setEditingField(null);
  setEditValues({});
};

// Sau đó sử dụng:
<EditableText 
  fieldName="unique-field-name"
  text="Nội dung hiển thị"
  className="your-css-classes"
  showEditButton={true}
  editingField={editingField}
  editValues={editValues}
  onEditStart={handleEditStart}
  onEditSave={handleEditSave}
  onEditCancel={handleEditCancel}
/>
```

## Trang hiện đã được cập nhật:

✅ **home.tsx** - Có đầy đủ state và logic edit
✅ **japanese-training.tsx** - Sử dụng chế độ chỉ đọc
✅ **study-abroad.tsx** - Sử dụng chế độ chỉ đọc
✅ **visa-services.tsx** - Sử dụng chế độ chỉ đọc

## Lưu ý quan trọng:
- Chỉ trang home.tsx có chức năng edit đầy đủ với testimonials
- Các trang khác đều sử dụng EditableText ở chế độ chỉ đọc
- Tất cả đều có cấu hình props đầy đủ để tránh lỗi undefined