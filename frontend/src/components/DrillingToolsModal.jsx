import { useState, useEffect } from 'react';
import { Modal, Table, InputNumber, Button, message, Typography, Tag, Space, Select } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../service/api';

const { Text } = Typography;
const { Option } = Select;

/**
 * DrillingToolsModal - Modal for managing drilling tools fitted to compressor
 * Tracks starting and ending RPM for each tool
 */
const DrillingToolsModal = ({ 
  visible, 
  onClose, 
  onSubmit, 
  compressorName,
  currentCompressorRPM,
  title = "Manage Drilling Tools" 
}) => {
  const [loading, setLoading] = useState(false);
  const [availableTools, setAvailableTools] = useState([]);
  const [fittedTools, setFittedTools] = useState([]);
  const [actionType, setActionType] = useState('fit'); // 'fit' or 'remove'

  // Fetch available drilling tools
  useEffect(() => {
    if (visible) {
      fetchAvailableTools();
      fetchFittedTools();
    }
  }, [visible]);

  const fetchAvailableTools = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/items/available-for-service?itemType=Drilling Tools`);
      setAvailableTools(res.data.data || []);
    } catch (err) {
      console.error('Error fetching drilling tools:', err);
      message.error('Error fetching drilling tools');
    } finally {
      setLoading(false);
    }
  };

  const fetchFittedTools = async () => {
    // TODO: Fetch currently fitted tools from ItemService
    // For now, use empty array
    setFittedTools([]);
  };

  const [selectedForFitting, setSelectedForFitting] = useState([]);
  const [selectedForRemoval, setSelectedForRemoval] = useState([]);

  const handleAddForFitting = (tool) => {
    if (selectedForFitting.find(t => t.itemId === tool.id)) {
      message.warning('Tool already added');
      return;
    }

    setSelectedForFitting([
      ...selectedForFitting,
      {
        itemId: tool.id,
        itemName: tool.itemName,
        partNumber: tool.partNumber,
        modelName: tool.modelName,
        startingRPM: currentCompressorRPM || 0,
        quantity: 1
      }
    ]);
  };

  const handleRemoveFromFitting = (itemId) => {
    setSelectedForFitting(prev => prev.filter(t => t.itemId !== itemId));
  };

  const handleStartingRPMChange = (itemId, rpm) => {
    setSelectedForFitting(prev =>
      prev.map(tool =>
        tool.itemId === itemId ? { ...tool, startingRPM: rpm } : tool
      )
    );
  };

  const handleSubmit = () => {
    if (actionType === 'fit') {
      if (selectedForFitting.length === 0) {
        message.warning('Please select at least one tool to fit');
        return;
      }

      // Validate starting RPM
      for (const tool of selectedForFitting) {
        if (!tool.startingRPM || tool.startingRPM <= 0) {
          message.error(`Starting RPM for ${tool.itemName} must be greater than 0`);
          return;
        }
      }

      onSubmit({
        action: 'fit',
        tools: selectedForFitting
      });
    } else {
      // Remove tools
      if (selectedForRemoval.length === 0) {
        message.warning('Please select at least one tool to remove');
        return;
      }

      onSubmit({
        action: 'remove',
        tools: selectedForRemoval,
        endingRPM: currentCompressorRPM
      });
    }

    setSelectedForFitting([]);
    setSelectedForRemoval([]);
    onClose();
  };

  const handleCancel = () => {
    setSelectedForFitting([]);
    setSelectedForRemoval([]);
    onClose();
  };

  // Columns for available tools
  const availableColumns = [
    {
      title: 'Tool Name',
      dataIndex: 'itemName',
      key: 'itemName',
      width: '30%',
    },
    {
      title: 'Model',
      dataIndex: 'modelName',
      key: 'modelName',
      width: '25%',
      render: (text) => text || '-'
    },
    {
      title: 'Part Number',
      dataIndex: 'partNumber',
      key: 'partNumber',
      width: '20%',
    },
    {
      title: 'Available',
      dataIndex: 'balance',
      key: 'balance',
      width: '15%',
      render: (balance) => (
        <Tag color="green">{balance} nos</Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: '10%',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => handleAddForFitting(record)}
          disabled={record.balance <= 0}
        >
          Fit
        </Button>
      ),
    },
  ];

  // Columns for selected tools for fitting
  const selectedColumns = [
    {
      title: 'Tool Name',
      dataIndex: 'itemName',
      key: 'itemName',
      width: '35%',
    },
    {
      title: 'Model',
      dataIndex: 'modelName',
      key: 'modelName',
      width: '25%',
      render: (text) => text || '-'
    },
    {
      title: 'Starting RPM',
      key: 'startingRPM',
      width: '25%',
      render: (_, record) => (
        <InputNumber
          min={0}
          value={record.startingRPM}
          onChange={(value) => handleStartingRPMChange(record.itemId, value)}
          style={{ width: '100%' }}
          placeholder="Enter RPM"
        />
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: '15%',
      render: (_, record) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveFromFitting(record.itemId)}
        />
      ),
    },
  ];

  return (
    <Modal
      title={title}
      open={visible}
      onCancel={handleCancel}
      onOk={handleSubmit}
      width={900}
      okText={actionType === 'fit' ? 'Fit Tools' : 'Remove Tools'}
      cancelText="Cancel"
      okButtonProps={{ 
        disabled: actionType === 'fit' 
          ? selectedForFitting.length === 0 
          : selectedForRemoval.length === 0 
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>Action:</Text>
          <Select
            value={actionType}
            onChange={setActionType}
            style={{ width: 150 }}
          >
            <Option value="fit">Fit Tools</Option>
            <Option value="remove">Remove Tools</Option>
          </Select>
          <Tag color="blue">Current Compressor RPM: {currentCompressorRPM || 0}</Tag>
        </Space>
      </div>

      {actionType === 'fit' && (
        <>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Available Drilling Tools</Text>
            <Table
              dataSource={availableTools}
              columns={availableColumns}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={false}
              scroll={{ y: 200 }}
              locale={{ emptyText: 'No drilling tools available' }}
            />
          </div>

          {selectedForFitting.length > 0 && (
            <div>
              <Text strong>Tools to Fit ({selectedForFitting.length})</Text>
              <Table
                dataSource={selectedForFitting}
                columns={selectedColumns}
                rowKey="itemId"
                size="small"
                pagination={false}
                scroll={{ y: 200 }}
              />
            </div>
          )}

          {selectedForFitting.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
              Select drilling tools from the table above
            </div>
          )}
        </>
      )}

      {actionType === 'remove' && (
        <div>
          <Text strong>Fitted Tools (Select to Remove)</Text>
          <Table
            dataSource={fittedTools}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ y: 300 }}
            locale={{ emptyText: 'No fitted tools found' }}
            rowSelection={{
              selectedRowKeys: selectedForRemoval.map(t => t.id),
              onChange: (_, selectedRows) => {
                setSelectedForRemoval(selectedRows);
              },
            }}
          />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">
              Ending RPM will be recorded as: <Tag>{currentCompressorRPM || 0}</Tag>
            </Text>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default DrillingToolsModal;

