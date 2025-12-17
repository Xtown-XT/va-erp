import React, { useState, useEffect } from "react";
import { Table, Card, Tag, Spin, message, Button, Modal, Form, Select, Radio, InputNumber, Space, Input } from "antd";
import { ReloadOutlined, PlusOutlined, DownloadOutlined } from "@ant-design/icons";
import api from "../service/api";
import dayjs from "dayjs";

const InventoryManagement = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('view'); // 'view' or 'add'
  const [selectedSite, setSelectedSite] = useState('all'); // 'all' or siteId

  // Stock Data
  const [siteStock, setSiteStock] = useState([]);
  // const [totals, setTotals] = useState({ totalSpares: 0, totalTools: 0 }); // Derived now

  // Dropdown Data
  const [sites, setSites] = useState([]);
  const [spares, setSpares] = useState([]);
  const [tools, setTools] = useState([]);

  // Form
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [itemType, setItemType] = useState('spare'); // 'spare' or 'tool'

  useEffect(() => {
    fetchSiteWiseStock();
    // Fetch dropdown data
    api.get('/api/sites?limit=1000').then(res => setSites(res.data.data)).catch(console.error);
    api.get('/api/spares?limit=1000').then(res => setSpares(res.data.data)).catch(console.error);
    api.get('/api/drilling-tools?limit=1000').then(res => setTools(res.data.data)).catch(console.error);
  }, []);

  const fetchSiteWiseStock = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/inventory/stock/sitewise');
      if (response.data.success) {
        setSiteStock(response.data.data.sites);
        // setTotals(response.data.data.totals);
      }
    } catch (error) {
      console.error('Error fetching stock:', error);
      message.error('Failed to load stock data');
    } finally {
      setLoading(false);
    }
  };

  const handleStockSubmit = async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        siteId: values.siteId,
        mode: values.mode, // 'add' or 'set'
        // For tools, quantity is handled in backend (count based)
        quantity: values.quantity,
        spareId: itemType === 'spare' ? values.itemId : null,
        drillingToolId: itemType === 'tool' ? values.itemId : null,
      };

      await api.post('/api/inventory/stock/update', payload);
      message.success("Stock Updated Successfully");

      form.resetFields();
      setItemType('spare'); // Reset to default
      setActiveTab('view'); // Switch back to view
      fetchSiteWiseStock();
    } catch (error) {
      message.error(error.response?.data?.message || "Failed to update stock");
    } finally {
      setSubmitting(false);
    }
  };

  // --- Aggregation Logic ---
  const aggregatedData = React.useMemo(() => {
    let filteredSites = siteStock;
    if (selectedSite && selectedSite !== 'all') {
      filteredSites = siteStock.filter(s => s.siteId === selectedSite);
    }

    const sparesMap = {};
    const toolsMap = {};
    let totalSparesCount = 0;
    let totalToolsCount = 0;

    filteredSites.forEach(site => {
      // Aggregate Spares
      site.spares.forEach(spare => {
        if (!sparesMap[spare.spareId]) {
          sparesMap[spare.spareId] = {
            ...spare,
            quantity: 0,
            siteNames: [] // Track which sites have it? Maybe too cluttery.
          };
        }
        sparesMap[spare.spareId].quantity += spare.quantity;
        totalSparesCount += spare.quantity;
      });

      // Aggregate Tools
      site.tools.forEach(tool => {
        if (!toolsMap[tool.toolId]) {
          toolsMap[tool.toolId] = {
            ...tool,
            quantity: 0
          };
        }
        toolsMap[tool.toolId].quantity += tool.quantity;
        totalToolsCount += tool.quantity;
      });
    });

    return {
      spares: Object.values(sparesMap),
      tools: Object.values(toolsMap),
      totals: {
        spares: Object.keys(sparesMap).length, // Count Unique Types
        tools: Object.keys(toolsMap).length   // Count Unique Types
      }
    };
  }, [siteStock, selectedSite]);


  // Columns for Item Lists
  const spareColumns = [
    { title: 'Spare Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Part Number', dataIndex: 'partNumber', key: 'partNumber' },
    {
      title: 'Total Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (qty) => <Tag color="blue" style={{ fontSize: '12px' }}>{qty}</Tag>,
      sorter: (a, b) => a.quantity - b.quantity
    }
  ];

  const toolColumns = [
    { title: 'Tool Name', dataIndex: 'name', key: 'name', sorter: (a, b) => a.name.localeCompare(b.name) },
    { title: 'Part Number', dataIndex: 'partNumber', key: 'partNumber' },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      render: (price) => price ? `₹${price}` : '-'
    },
    {
      title: 'Total Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (qty) => <Tag color="green" style={{ fontSize: '12px' }}>{qty}</Tag>,
      sorter: (a, b) => a.quantity - b.quantity
    }
  ];

  // Export to CSV
  const handleExport = () => {
    // Flatten data for export
    const sparesRows = aggregatedData.spares.map(s => ({
      Type: 'Spare',
      Name: s.name,
      PartNumber: s.partNumber,
      Quantity: s.quantity
    }));

    const toolsRows = aggregatedData.tools.map(t => ({
      Type: 'Drilling Tool',
      Name: t.name,
      PartNumber: t.partNumber,
      Quantity: t.quantity
    }));

    const allRows = [...sparesRows, ...toolsRows];

    if (allRows.length === 0) {
      message.warning("No data to export");
      return;
    }

    // Convert to CSV
    const headers = ["Type", "Name", "PartNumber", "Quantity"];
    const csvContent = [
      headers.join(","),
      ...allRows.map(row => headers.map(fieldName => JSON.stringify(row[fieldName] || "")).join(","))
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `inventory_stock_${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-2">
      <Card
        size="small"
        title="Inventory"
        tabList={[
          { key: 'view', tab: 'View Stock' },
          { key: 'add', tab: 'Add Items' }
        ]}
        activeTabKey={activeTab}
        onTabChange={key => {
          setActiveTab(key);
          if (key === 'view') fetchSiteWiseStock();
        }}
        extra={
          activeTab === 'view' && (
            <Space size="small">
              {/* Compact Totals in Header */}
              <Tag color="geekblue">Spares Types: {aggregatedData.totals.spares}</Tag>
              <Tag color="cyan">Tool Types: {aggregatedData.totals.tools}</Tag>

              <Select
                size="small"
                value={selectedSite}
                onChange={setSelectedSite}
                style={{ width: 150 }}
                placeholder="Filter Site"
              >
                <Select.Option value="all">All Sites</Select.Option>
                {sites.map(s => (
                  <Select.Option key={s.id} value={s.id}>{s.siteName}</Select.Option>
                ))}
              </Select>
              <Button size="small" onClick={fetchSiteWiseStock} icon={<ReloadOutlined spin={loading} />} />
              <Button size="small" onClick={handleExport} icon={<DownloadOutlined />}>Export</Button>
            </Space>
          )
        }
        bodyStyle={{ padding: '0px' }} // Remove default body padding for full-width tables
      >
        {activeTab === 'view' ? (
          <Spin spinning={loading}>
            <div className="bg-white">
              <div className="p-2">
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {/* Two compact tables side-by-side or stacked? Stacked is safer for columns.
                            User said "fits in one page". Side by side might be better if screen wide.
                            Let's try a split view.
                        */}
                  <div className="flex flex-col md:flex-row gap-2">
                    <div className="flex-1 border rounded p-1">
                      <div className="text-xs font-bold text-green-700 bg-green-50 p-1 mb-1 rounded uppercase tracking-wider">
                        Drilling Tools
                      </div>
                      <Table
                        columns={toolColumns}
                        dataSource={aggregatedData.tools}
                        rowKey="toolId"
                        pagination={{ pageSize: 10, size: "small" }}
                        size="small"
                      />
                    </div>

                    <div className="flex-1 border rounded p-1">
                      <div className="text-xs font-bold text-blue-700 bg-blue-50 p-1 mb-1 rounded uppercase tracking-wider">
                        Spares
                      </div>
                      <Table
                        columns={spareColumns}
                        dataSource={aggregatedData.spares}
                        rowKey="spareId"
                        pagination={{ pageSize: 10, size: "small" }}
                        size="small"
                      />
                    </div>
                  </div>
                </Space>
              </div>
            </div>

          </Spin>
        ) : (
          <div className="max-w-xl mx-auto p-4">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleStockSubmit}
              initialValues={{ mode: 'add', quantity: 0 }}
              size="small"
            >
              <Form.Item name="siteId" label="Select Site" rules={[{ required: true }]}>
                <Select placeholder="Choose destination site">
                  {sites.map(s => <Select.Option key={s.id} value={s.id}>{s.siteName}</Select.Option>)}
                </Select>
              </Form.Item>

              <div className="mb-2">
                <label className="block mb-1 font-medium">Type</label>
                <Radio.Group
                  value={itemType}
                  onChange={e => {
                    setItemType(e.target.value);
                    form.setFieldsValue({ itemId: null });
                  }}
                  buttonStyle="solid"
                >
                  <Radio.Button value="spare">Spare Part</Radio.Button>
                  <Radio.Button value="tool">Drilling Tool</Radio.Button>
                </Radio.Group>
              </div>

              <Form.Item
                name="itemId"
                label={itemType === 'spare' ? "Select Spare" : "Select Tool"}
                rules={[{ required: true }]}
              >
                <Select showSearch placeholder="Search Item" optionFilterProp="children">
                  {itemType === 'spare'
                    ? spares.map(s => <Select.Option key={s.id} value={s.id}>{s.name} ({s.partNumber})</Select.Option>)
                    : tools.map(t => <Select.Option key={t.id} value={t.id}>{t.name} ({t.partNumber})</Select.Option>)
                  }
                </Select>
              </Form.Item>

              <Form.Item name="mode" label="Action">
                <Radio.Group>
                  <Radio value="add">Add</Radio>
                  <Radio value="set">Set</Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
                <InputNumber className="w-full" placeholder="Qty" />
              </Form.Item>

              <Button type="primary" htmlType="submit" block loading={submitting} icon={<PlusOutlined />}>
                Update Stock
              </Button>
            </Form>
          </div>
        )}
      </Card>
    </div>
  );
};

export default InventoryManagement;
