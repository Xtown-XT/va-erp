// import { useState, useEffect } from "react";
// import {
//   Card,
//   Table,
//   Button,
//   Input,
//   Space,
//   Typography,
//   Tag,
//   Row,
//   Col,
//   Statistic,
//   message,
//   Modal,
//   Form,
//   Select,
//   InputNumber,
// } from "antd";
// import {
//   ReloadOutlined,
//   PlusOutlined,
// } from "@ant-design/icons";
// import api from "../service/api";

// const { Title, Text } = Typography;

// const InventoryManagement = () => {
//   const [loading, setLoading] = useState(false);
//   const [items, setItems] = useState([]);
//   const [stockData, setStockData] = useState([]);
//   const [searchTerm, setSearchTerm] = useState("");
//   const [showAddForm, setShowAddForm] = useState(false);
//   const [addForm] = Form.useForm();
//   const [itemInstances, setItemInstances] = useState([]);

//   // Fetch all data
//   const fetchData = async () => {
//     setLoading(true);
//     try {
//       const [itemsRes, instancesRes] = await Promise.all([
//         api.get("/api/items"),
//         api.get("/api/itemInstances")
//       ]);

//       const items = itemsRes.data.data || [];
//       const instances = instancesRes.data.data || [];

//       setItems(items);
//       setItemInstances(instances);
//       setStockData(items); // Items now have stock field directly
//     } catch (err) {
//       console.error("Error fetching inventory data", err);
//       message.error("Error fetching inventory data");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Handle adding item instance
//   const handleAddStock = async (values) => {
//     try {
//       const { itemId, quantity, nextServiceRPM, notes } = values;

//       const payload = {
//         itemId,
//         quantity,
//         nextServiceRPM: nextServiceRPM ? parseInt(nextServiceRPM) : null,
//         notes
//       };

//       const response = await api.post("/api/stockTransactions/add-stock", payload);
//       message.success(response.data.message);
//       setShowAddForm(false);
//       addForm.resetFields();
//       fetchData();
//     } catch (err) {
//       console.error("Error adding stock", err);
//       message.error("Error adding stock");
//     }
//   };

//   useEffect(() => {
//     fetchData();
//   }, []);

//   // Stock columns
//   const stockColumns = [
//     {
//       title: "Item Name",
//       dataIndex: "itemName",
//       key: "itemName",
//       render: (text, record) => (
//         <div>
//           <Text strong>{text}</Text>
//           <br />
//           <Text type="secondary" style={{ fontSize: '12px' }}>
//             {record.partNumber}
//           </Text>
//         </div>
//       ),
//     },
//     {
//       title: "Stock Available",
//       dataIndex: "stock",
//       key: "stock",
//       render: (value) => (
//         <Text strong style={{
//           color: value > 0 ? '#52c41a' : '#ff4d4f',
//           fontSize: '16px'
//         }}>
//           {value || 0}
//         </Text>
//       ),
//     },
//     {
//       title: "Unit Price",
//       dataIndex: "purchaseRate",
//       key: "purchaseRate",
//       render: (value) => `₹${value || 0}`,
//     },
//     {
//       title: "GST %",
//       dataIndex: "gst",
//       key: "gst",
//       render: (value) => `${value || 0}%`,
//     },
//     {
//       title: "Can Be Fitted",
//       dataIndex: "canBeFitted",
//       key: "canBeFitted",
//       render: (value) => (
//         <Tag color={value ? "blue" : "default"}>
//           {value ? "Yes" : "No"}
//         </Tag>
//       ),
//     },
//   ];


//   // Calculate summary statistics
//   const calculateSummary = () => {
//     const totalItems = stockData.length;
//     const totalStock = stockData.reduce((sum, item) => sum + (item.stock || 0), 0);
//     const itemsInStock = stockData.filter(item => (item.stock || 0) > 0).length;
//     const itemsOutOfStock = stockData.filter(item => (item.stock || 0) === 0).length;

//     return {
//       totalItems,
//       totalStock,
//       itemsInStock,
//       itemsOutOfStock,
//     };
//   };

//   const summary = calculateSummary();


//   return (
//     <div className="space-y-6">
//       {/* Header */}
//       <div className="flex justify-between items-center">
//         <div>
//           <Title level={2} className="mb-2">Inventory Management</Title>
//           <Text type="secondary">Track stock levels and transactions</Text>
//         </div>
//         <Space>
//           <Button
//             icon={<ReloadOutlined />}
//             onClick={fetchData}
//             loading={loading}
//           >
//             Refresh
//           </Button>
//         </Space>
//       </div>

//       {/* Summary Statistics */}
//       <Row gutter={[16, 16]}>
//         <Col xs={24} md={12} lg={6}>
//           <Card>
//             <Statistic
//               title="Total Items"
//               value={summary.totalItems}
//               valueStyle={{ color: '#1890ff' }}
//             />
//           </Card>
//         </Col>
//         <Col xs={24} md={12} lg={6}>
//           <Card>
//             <Statistic
//               title="Total Stock"
//               value={summary.totalStock}
//               valueStyle={{ color: '#1890ff' }}
//             />
//           </Card>
//         </Col>
//         <Col xs={24} md={12} lg={6}>
//           <Card>
//             <Statistic
//               title="Items In Stock"
//               value={summary.itemsInStock}
//               valueStyle={{ color: '#52c41a' }}
//             />
//           </Card>
//         </Col>
//         <Col xs={24} md={12} lg={6}>
//           <Card>
//             <Statistic
//               title="Items Out of Stock"
//               value={summary.itemsOutOfStock}
//               valueStyle={{ color: '#ff4d4f' }}
//             />
//           </Card>
//         </Col>
//       </Row>

//       {/* Stock Table */}
//       <Card>
//         <div className="mb-4 flex justify-between items-center">
//           <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
//             <Input.Search
//               placeholder="Search items..."
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//               style={{ maxWidth: 300 }}
//             />
//             <Button
//               onClick={() => setSearchTerm('')}
//               disabled={!searchTerm}
//             >
//               Clear Filters
//             </Button>
//           </div>
//         </div>
//         <Table
//           columns={stockColumns}
//           dataSource={stockData.filter(item =>
//             item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
//             item.partNumber?.toLowerCase().includes(searchTerm.toLowerCase())
//           )}
//           rowKey="id"
//           loading={loading}
//           pagination={{ pageSize: 20 }}
//           scroll={{ x: 800 }}
//         />
//       </Card>

//       {/* Add Stock flow removed: handled via Item page and auto on PO receive */}
//     </div>
//   );
// };

// export default InventoryManagement;

import { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Statistic,
  message,
} from "antd";
import { MdOutlineInventory2, MdInventory } from "react-icons/md";
import { ReloadOutlined, ToolOutlined, DatabaseOutlined, InboxOutlined, DropboxOutlined } from "@ant-design/icons";
import api from "../service/api";

const { Title, Text } = Typography;

const InventoryManagement = () => {
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
  });

  const [summary, setSummary] = useState({
    totalItems: 0,
    totalStock: 0,
    itemsInStock: 0,
    itemsOutOfStock: 0,
  });

  // ✅ Fetch paginated items
  const fetchPaginatedData = async (page = 1, limit = 10) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/items?page=${page}&limit=${limit}`);
      setStockData(res.data.data || []);

      setPagination((prev) => ({
        ...prev,
        current: res.data.page || page,
        total: res.data.total || 0,
      }));
    } catch (err) {
      console.error("Error fetching inventory data", err);
      message.error("Error fetching inventory data");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Fetch overall summary (all items without pagination)
  const fetchSummary = async () => {
    try {
      const res = await api.get("/api/items?limit=1000"); // fetch all data with high limit
      const items = res.data.data || [];

      const totalItems = items.length;
      const totalStock = items.reduce((sum, i) => sum + (i.stock || 0), 0);
      const itemsInStock = items.filter((i) => (i.stock || 0) > 0).length;
      const itemsOutOfStock = items.filter((i) => (i.stock || 0) === 0).length;

      setSummary({
        totalItems,
        totalStock,
        itemsInStock,
        itemsOutOfStock,
      });
    } catch (err) {
      console.error("Error fetching summary", err);
    }
  };

  useEffect(() => {
    fetchPaginatedData(pagination.current, pagination.pageSize);
    fetchSummary(); // ✅ Fetch summary once
  }, []);

  // ✅ Handle pagination change
  const handleTableChange = (pagination) => {
    fetchPaginatedData(pagination.current, pagination.pageSize);
  };

  const stockColumns = [
    {
      title: "Item Name",
      dataIndex: "itemName",
      key: "itemName",
      render: (text, record) => (
        <div>
          <Text strong>{text}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: "12px" }}>
            {record.partNumber}
          </Text>
        </div>
      ),
    },
    {
      title: "Stock Available",
      dataIndex: "stock",
      key: "stock",
      render: (value) => (
        <Text
          strong
          style={{
            color: value > 0 ? "#52c41a" : "#ff4d4f",
            fontSize: "16px",
          }}
        >
          {value || 0}
        </Text>
      ),
    },
    {
      title: "Unit Price",
      dataIndex: "purchaseRate",
      key: "purchaseRate",
      render: (value) => `₹${value || 0}`,
    },
    {
      title: "GST %",
      dataIndex: "gst",
      key: "gst",
      render: (value) => `${value || 0}%`,
    },
    {
      title: "Can Be Fitted",
      dataIndex: "canBeFitted",
      key: "canBeFitted",
      render: (value) => (
        <Tag color={value ? "blue" : "default"}>{value ? "Yes" : "No"}</Tag>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <Title level={2} className="mb-2">
            Inventory Management
          </Title>
          <Text type="secondary">Track stock levels and transactions</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchPaginatedData(pagination.current, pagination.pageSize);
              fetchSummary();
            }}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* ✅ Summary cards now show total data (not page data) */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} lg={6}>
          <Card>
            
            <Statistic
              title="Total Items"
              prefix={<ToolOutlined style={{ fontSize: '22px', color: '#1890ff', marginRight: '5px', marginTop: "5px" }} />}
              value={summary.totalItems}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <Card>
            <Statistic
              title="Total Stock"
              value={summary.totalStock}
              prefix={<DatabaseOutlined style={{ fontSize: '22px', color: '#52c41a', marginRight: '5px', marginTop: "5px" }}/>}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <Card>
            <Statistic
              title="Items In Stock"
              value={summary.itemsInStock}
              prefix={<InboxOutlined style={{ fontSize: '22px', color: '#52c41a', marginRight: '5px', marginTop: "5px" }}/>}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col xs={24} md={12} lg={6}>
          <Card>
            <Statistic
              title="Items Out of Stock"
              value={summary.itemsOutOfStock}
              prefix={<DropboxOutlined style={{ fontSize: '22px', color: '#ff4d4f', marginRight: '5px', marginTop: "5px" }}/>}
              valueStyle={{ color: "#ff4d4f" }}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card>
        <div className="mb-4 flex justify-between items-center">
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <Input.Search
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ maxWidth: 300 }}
            />
            <Button onClick={() => setSearchTerm("")} disabled={!searchTerm}>
              Clear Filters
            </Button>
          </div>
        </div>

        <Table
          columns={stockColumns}
          dataSource={stockData.filter(
            (item) =>
              item.itemName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              item.partNumber?.toLowerCase().includes(searchTerm.toLowerCase())
          )}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
          }}
          onChange={handleTableChange}
        />
      </Card>
    </div>
  );
};

export default InventoryManagement;
