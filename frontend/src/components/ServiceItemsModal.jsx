import { useState, useEffect } from 'react';
import { Modal, Table, InputNumber, Button, message, Typography, Tag, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../service/api';

const { Text } = Typography;

/**
 * ServiceItemsModal - Modal for selecting service items for machine or compressor
 * @param {boolean} visible - Modal visibility
 * @param {function} onClose - Close handler
 * @param {function} onSubmit - Submit handler with selected items
 * @param {string} serviceType - 'machine' or 'compressor'
 * @param {string} itemType - Item type to filter (machine name or compressor name)
 * @param {string} title - Modal title
 */
const ServiceItemsModal = ({ 
  visible, 
  onClose, 
  onSubmit, 
  serviceType, 
  itemType,
  title = "Select Service Items" 
}) => {
  const [loading, setLoading] = useState(false);
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);

  // Fetch available items for this item type
  useEffect(() => {
    if (visible && itemType) {
      fetchAvailableItems();
    }
  }, [visible, itemType]);

  const fetchAvailableItems = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/items/available-for-service?itemType=${encodeURIComponent(itemType)}`);
      setAvailableItems(res.data.data || []);
    } catch (err) {
      console.error('Error fetching available items:', err);
      message.error('Error fetching available items');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = (item) => {
    // Check if already added
    if (selectedItems.find(si => si.itemId === item.id)) {
      message.warning('Item already added');
      return;
    }

    setSelectedItems([
      ...selectedItems,
      {
        itemId: item.id,
        itemName: item.itemName,
        partNumber: item.partNumber,
        availableBalance: item.balance,
        quantity: 1,
        units: item.units,
        modelName: item.modelName
      }
    ]);
  };

  const handleQuantityChange = (itemId, quantity) => {
    setSelectedItems(prev =>
      prev.map(item =>
        item.itemId === itemId ? { ...item, quantity } : item
      )
    );
  };

  const handleRemoveItem = (itemId) => {
    setSelectedItems(prev => prev.filter(item => item.itemId !== itemId));
  };

  const handleSubmit = () => {
    // Validate quantities
    for (const item of selectedItems) {
      if (item.quantity <= 0) {
        message.error(`Quantity for ${item.itemName} must be greater than 0`);
        return;
      }
      if (item.quantity > item.availableBalance) {
        message.error(`Quantity for ${item.itemName} exceeds available balance (${item.availableBalance})`);
        return;
      }
    }

    if (selectedItems.length === 0) {
      message.warning('Please select at least one item');
      return;
    }

    // Pass selected items back to parent
    onSubmit(selectedItems);
    setSelectedItems([]);
    onClose();
  };

  const handleCancel = () => {
    setSelectedItems([]);
    onClose();
  };

  // Columns for available items table
  const availableColumns = [
    {
      title: 'Item Name',
      dataIndex: 'itemName',
      key: 'itemName',
      width: '30%',
    },
    {
      title: 'Part Number',
      dataIndex: 'partNumber',
      key: 'partNumber',
      width: '20%',
    },
    {
      title: 'Model',
      dataIndex: 'modelName',
      key: 'modelName',
      width: '15%',
      render: (text) => text || '-'
    },
    {
      title: 'Available',
      dataIndex: 'balance',
      key: 'balance',
      width: '15%',
      render: (balance, record) => (
        <Tag color="green">{balance} {record.units}</Tag>
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: '20%',
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => handleAddItem(record)}
          disabled={record.balance <= 0}
        >
          Add
        </Button>
      ),
    },
  ];

  // Columns for selected items table
  const selectedColumns = [
    {
      title: 'Item Name',
      dataIndex: 'itemName',
      key: 'itemName',
      width: '30%',
    },
    {
      title: 'Part Number',
      dataIndex: 'partNumber',
      key: 'partNumber',
      width: '20%',
    },
    {
      title: 'Available',
      dataIndex: 'availableBalance',
      key: 'availableBalance',
      width: '15%',
      render: (balance, record) => (
        <Text type="secondary">{balance} {record.units}</Text>
      )
    },
    {
      title: 'Quantity',
      key: 'quantity',
      width: '20%',
      render: (_, record) => (
        <InputNumber
          min={1}
          max={record.availableBalance}
          value={record.quantity}
          onChange={(value) => handleQuantityChange(record.itemId, value)}
          style={{ width: '100%' }}
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
          onClick={() => handleRemoveItem(record.itemId)}
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
      okText="Confirm Service"
      cancelText="Cancel"
      okButtonProps={{ disabled: selectedItems.length === 0 }}
    >
      <div style={{ marginBottom: 16 }}>
        <Text strong>Available Items for {itemType}</Text>
        <Table
          dataSource={availableItems}
          columns={availableColumns}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={false}
          scroll={{ y: 200 }}
          locale={{ emptyText: 'No items available for this type' }}
        />
      </div>

      {selectedItems.length > 0 && (
        <div>
          <Text strong>Selected Items ({selectedItems.length})</Text>
          <Table
            dataSource={selectedItems}
            columns={selectedColumns}
            rowKey="itemId"
            size="small"
            pagination={false}
            scroll={{ y: 200 }}
          />
        </div>
      )}

      {selectedItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
          Select items from the table above
        </div>
      )}
    </Modal>
  );
};

export default ServiceItemsModal;

