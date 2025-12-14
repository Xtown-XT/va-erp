import React, { useState, useEffect } from "react";
import { Table, Card, Tag, Spin, message, Button, Modal, Form, Select, Radio, InputNumber, Space, Input } from "antd";
import { ReloadOutlined, PlusOutlined } from "@ant-design/icons";
import api from "../service/api";

const InventoryManagement = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('view'); // 'view' or 'add'

  // Stock Data
  const [siteStock, setSiteStock] = useState([]);
  const [totals, setTotals] = useState({ totalSpares: 0, totalTools: 0 });

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
    api.get('/api/sites').then(res => setSites(res.data.data)).catch(console.error);
    api.get('/api/spares').then(res => setSpares(res.data.data)).catch(console.error);
    api.get('/api/drilling-tools').then(res => setTools(res.data.data)).catch(console.error);
  }, []);

  const fetchSiteWiseStock = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/inventory/stock/sitewise');
      if (response.data.success) {
        setSiteStock(response.data.data.sites);
        setTotals(response.data.data.totals);
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
        // For tools, quantity is handled in backend (effectively 1 per SN)
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

  // Expandable row for tools
  const expandedRowRender = (record) => {
    const toolColumns = [
      { title: 'Tool Name', dataIndex: 'name', key: 'name' },
      { title: 'Part Number', dataIndex: 'partNumber', key: 'partNumber' },
      { title: 'Quantity', dataIndex: 'quantity', key: 'quantity' },
      {
        title: 'Price',
        dataIndex: 'price',
        key: 'price',
        render: (price) => price ? `₹${price}` : '-'
      }
    ];

    return (
      <div className="pl-8">
        <h4 className="font-semibold mb-2">Drilling Tools</h4>
        {record.tools.length > 0 ? (
          <Table
            columns={toolColumns}
            dataSource={record.tools}
            pagination={false}
            size="small"
            rowKey="id"
          />
        ) : (
          <p className="text-gray-500">No tools in stock</p>
        )}

        <h4 className="font-semibold mt-4 mb-2">Spares</h4>
        {record.spares.length > 0 ? (
          <Table
            columns={[
              { title: 'Spare Name', dataIndex: 'name', key: 'name' },
              { title: 'Part Number', dataIndex: 'partNumber', key: 'partNumber' },
              { title: 'Category', dataIndex: 'category', key: 'category' },
              { title: 'Quantity', dataIndex: 'quantity', key: 'quantity' }
            ]}
            dataSource={record.spares}
            pagination={false}
            size="small"
            rowKey="id"
          />
        ) : (
          <p className="text-gray-500">No spares in stock</p>
        )}
      </div>
    );
  };

  const columns = [
    {
      title: 'Site Name',
      dataIndex: 'siteName',
      key: 'siteName',
      sorter: (a, b) => a.siteName.localeCompare(b.siteName),
      render: (text) => <span className="font-medium">{text}</span>
    },
    {
      title: 'Spares Count',
      dataIndex: 'sparesCount',
      key: 'sparesCount',
      render: (count) => <Tag color="blue">{count}</Tag>
    },
    {
      title: 'Tools Count',
      dataIndex: 'toolsCount',
      key: 'toolsCount',
      render: (count) => <Tag color="green">{count}</Tag>
    }
  ];

  // Summary row
  const summaryRow = () => (
    <Table.Summary fixed>
      <Table.Summary.Row className="bg-gray-100 font-bold">
        <Table.Summary.Cell index={0}>
          <span className="font-bold">TOTAL</span>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={1}>
          <Tag color="blue" className="font-bold">{totals.totalSpares}</Tag>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={2}>
          <Tag color="green" className="font-bold">{totals.totalTools}</Tag>
        </Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );

  return (
    <div className="p-4">
      <Card
        title="Inventory Management"
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
            <button
              onClick={fetchSiteWiseStock}
              className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              <ReloadOutlined spin={loading} />

            </button>
          )
        }
      >
        {activeTab === 'view' ? (
          <Spin spinning={loading}>
            <Table
              columns={columns}
              dataSource={siteStock}
              rowKey="siteId"
              expandable={{
                expandedRowRender,
                rowExpandable: (record) => record.tools.length > 0 || record.spares.length > 0
              }}
              pagination={{ pageSize: 50 }}
              summary={summaryRow}
            />
          </Spin>
        ) : (
          <div className="max-w-2xl mx-auto">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleStockSubmit}
              initialValues={{ mode: 'add', quantity: 0 }}
            >
              <Card type="inner" title="Add New Inventory Item">
                <Form.Item name="siteId" label="Select Site" rules={[{ required: true }]}>
                  <Select placeholder="Choose destination site">
                    {sites.map(s => <Select.Option key={s.id} value={s.id}>{s.siteName}</Select.Option>)}
                  </Select>
                </Form.Item>

                <div className="mb-4">
                  <label className="block mb-2 font-medium">What are you adding?</label>
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
                  label={itemType === 'spare' ? "Select Spare Part" : "Select Drilling Tool Type"}
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
                    <Radio value="add">Add to Stock</Radio>
                    <Radio value="set">Set Exact Count</Radio>
                  </Radio.Group>
                </Form.Item>

                <Form.Item name="quantity" label="Quantity" rules={[{ required: true }]}>
                  <InputNumber className="w-full" placeholder="Enter quantity" />
                </Form.Item>

                <Button type="primary" htmlType="submit" block loading={submitting} size="large" icon={<PlusOutlined />}>
                  Update Stock
                </Button>
              </Card>
            </Form>
          </div>
        )}
      </Card>
    </div>
  );
};

export default InventoryManagement;
