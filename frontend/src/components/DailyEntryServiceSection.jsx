import { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Select,
  InputNumber,
  Space,
  Typography,
  Tag,
  Popconfirm,
  message,
} from "antd";
import { PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useItemsByType, useFittedItems } from "../hooks/useQueries";
import { truncateToFixed } from "../utils/textUtils";

const { Title, Text } = Typography;
const { Option } = Select;

/**
 * Service Section Component for Daily Entry
 * Handles fitting and removing items for machines and compressors
 * 
 * Props:
 * - serviceType: 'machine' or 'compressor'
 * - vehicleId: ID of the machine (for machine service)
 * - compressorId: ID of the compressor (for compressor service)
 * - itemTypeName: Name of the item type (e.g., machine number or compressor name)
 * - currentRPM: Current RPM reading
 * - currentMeter: Current meter reading (for drilling tools)
 * - date: Date of the entry
 * - serviceItems: Array of service items (for form state)
 * - onServiceItemsChange: Callback when service items change
 */
const DailyEntryServiceSection = ({
  serviceType = "machine", // 'machine' or 'compressor'
  vehicleId,
  compressorId,
  itemTypeName,
  currentRPM = 0,
  currentMeter = 0,
  date,
  serviceItems = [],
  onServiceItemsChange,
}) => {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Fetch available items by type
  const { data: availableItems = [], isLoading: itemsLoading } = useItemsByType(
    itemTypeName
  );

  // Fetch currently fitted items
  const { data: fittedItems = [], isLoading: fittedLoading } = useFittedItems(
    vehicleId,
    compressorId
  );

  // Handle fit item
  const handleFitItem = () => {
    if (!selectedItemId) {
      message.warning("Please select an item to fit");
      return;
    }

    const item = availableItems.find((i) => i.id === selectedItemId);
    if (!item) {
      message.error("Item not found");
      return;
    }

    if (item.balance < quantity) {
      message.error(`Insufficient balance. Available: ${item.balance}`);
      return;
    }

    // Add to service items list
    const newServiceItem = {
      itemId: selectedItemId,
      action: "fit",
      quantity,
      itemName: item.itemName,
      partNumber: item.partNumber,
      balance: item.balance,
    };

    onServiceItemsChange([...serviceItems, newServiceItem]);
    setSelectedItemId("");
    setQuantity(1);
    message.success("Item added to fit list");
  };

  // Handle remove fitted item
  const handleRemoveItem = (itemServiceId, itemName) => {
    const newServiceItem = {
      itemServiceId,
      action: "remove",
      itemName,
    };

    onServiceItemsChange([...serviceItems, newServiceItem]);
    message.success("Item added to remove list");
  };

  // Handle delete from pending list
  const handleDeletePending = (index) => {
    const newServiceItems = [...serviceItems];
    newServiceItems.splice(index, 1);
    onServiceItemsChange(newServiceItems);
  };

  // Calculate RPM run for fitted items
  const calculateRPMRun = (fittedRPM) => {
    return Math.max(0, currentRPM - fittedRPM);
  };

  // Columns for currently fitted items
  const fittedColumns = [
    {
      title: "Item Name",
      dataIndex: ["item", "itemName"],
      key: "itemName",
    },
    {
      title: "Part Number",
      dataIndex: ["item", "partNumber"],
      key: "partNumber",
    },
    {
      title: "Fitted Date",
      dataIndex: "fittedDate",
      key: "fittedDate",
    },
    {
      title: "Fitted RPM",
      dataIndex: "fittedRPM",
      key: "fittedRPM",
      render: (value) => truncateToFixed(value || 0, 2),
    },
    {
      title: "Current RPM",
      key: "currentRPM",
      render: () => (
        <Text strong style={{ color: "#1890ff" }}>
          {truncateToFixed(currentRPM, 2)}
        </Text>
      ),
    },
    {
      title: "RPM Run",
      key: "rpmRun",
      render: (_, record) => (
        <Text strong style={{ color: "#52c41a" }}>
          {truncateToFixed(calculateRPMRun(record.fittedRPM), 2)}
        </Text>
      ),
    },
    ...(serviceType === "compressor"
      ? [
          {
            title: "Meter Run",
            dataIndex: "fittedMeter",
            key: "meterRun",
            render: (fittedMeter) => {
              const meterRun = fittedMeter
                ? Math.max(0, currentMeter - fittedMeter)
                : 0;
              return truncateToFixed(meterRun, 2) + " m";
            },
          },
        ]
      : []),
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (value) => (
        <Tag color={value === "fitted" ? "blue" : "default"}>{value}</Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      render: (_, record) => (
        <Button
          type="link"
          danger
          size="small"
          onClick={() => handleRemoveItem(record.id, record.item?.itemName)}
        >
          Remove
        </Button>
      ),
    },
  ];

  // Columns for pending service items
  const pendingColumns = [
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      render: (value) => (
        <Tag color={value === "fit" ? "green" : "red"}>
          {value === "fit" ? "Fit" : "Remove"}
        </Tag>
      ),
    },
    {
      title: "Item Name",
      dataIndex: "itemName",
      key: "itemName",
    },
    {
      title: "Part Number",
      dataIndex: "partNumber",
      key: "partNumber",
      render: (value) => value || "-",
    },
    {
      title: "Quantity",
      dataIndex: "quantity",
      key: "quantity",
      render: (value) => value || 1,
    },
    {
      title: "Available Balance",
      dataIndex: "balance",
      key: "balance",
      render: (value) => (value !== undefined ? truncateToFixed(value, 2) : "-"),
    },
    {
      title: "Action",
      key: "delete",
      render: (_, record, index) => (
        <Popconfirm
          title="Remove this pending action?"
          onConfirm={() => handleDeletePending(index)}
          okText="Yes"
          cancelText="No"
        >
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            size="small"
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <Card
      title={
        <Title level={5}>
          {serviceType === "machine" ? "Machine" : "Compressor"} Service Items
        </Title>
      }
      style={{ marginTop: 16 }}
    >
      {/* Currently Fitted Items */}
      <div style={{ marginBottom: 20 }}>
        <Text strong>Currently Fitted Items:</Text>
        <Table
          columns={fittedColumns}
          dataSource={fittedItems}
          loading={fittedLoading}
          rowKey="id"
          size="small"
          pagination={false}
          style={{ marginTop: 8 }}
          locale={{ emptyText: "No items currently fitted" }}
        />
      </div>

      {/* Fit New Item */}
      <Card size="small" style={{ marginBottom: 20, backgroundColor: "#f0f2f5" }}>
        <Text strong>Fit New Item:</Text>
        <Space style={{ marginTop: 8, width: "100%" }} direction="vertical">
          <Space>
            <Select
              placeholder="Select item to fit"
              value={selectedItemId}
              onChange={setSelectedItemId}
              style={{ width: 300 }}
              showSearch
              loading={itemsLoading}
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {availableItems.map((item) => (
                <Option key={item.id} value={item.id}>
                  {item.itemName} ({item.partNumber}) - Bal: {truncateToFixed(item.balance, 2)}
                </Option>
              ))}
            </Select>
            <InputNumber
              placeholder="Quantity"
              value={quantity}
              onChange={setQuantity}
              min={1}
              style={{ width: 100 }}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleFitItem}
              disabled={!selectedItemId}
            >
              Add to Fit
            </Button>
          </Space>
        </Space>
      </Card>

      {/* Pending Service Items */}
      {serviceItems.length > 0 && (
        <div>
          <Text strong>Pending Service Actions (will be processed on save):</Text>
          <Table
            columns={pendingColumns}
            dataSource={serviceItems}
            rowKey={(record, index) => index}
            size="small"
            pagination={false}
            style={{ marginTop: 8 }}
          />
        </div>
      )}
    </Card>
  );
};

export default DailyEntryServiceSection;

