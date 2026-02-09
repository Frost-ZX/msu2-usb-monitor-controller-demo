window.addEventListener('DOMContentLoaded', () => {

  const connectButton = document.getElementById('connect-button');
  const disconnectButton = document.getElementById('disconnect-button');
  const startButton = document.getElementById('start-button');
  const stopButton = document.getElementById('stop-button');
  const canvas = document.getElementById('monitor-canvas');
  const ctx = canvas.getContext('2d');

  // 全局变量
  let port = null;
  let reader = null;
  let writer = null;
  let deviceState = 0; // 0: 未连接, 1: 已连接
  let refreshInterval = 200; // 刷新间隔（毫秒）
  let animationId = null;
  let lastRefreshTime = 0;

  // 显示参数
  const SHOW_WIDTH = 350; // 屏幕宽度
  const SHOW_HEIGHT = 172; // 屏幕高度

  // RGB565颜色定义
  const RED = 0xF800;
  const GREEN = 0x07E0;
  const BLUE = 0x001F;
  const WHITE = 0xFFFF;
  const BLACK = 0x0000;
  const YELLOW = 0xFFE0;
  const CYAN = 0x07FF;
  const MAGENTA = 0xF81F;
  const ORANGE = 0xFC00;

  // 模拟系统监控数据
  class SystemMonitor {
    constructor() {
      this.monitorData = {};
      this.font = '32px Arial';
    }

    collectSystemData() {

      let date = new Date();

      // 生成模拟数据
      this.monitorData = {
        row_1: {
          value: `${String(date.getFullYear()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          label: '日期',
          unit: '',
          detail: '',
          color: '#FFFF00',
          icon: 'I',
        },
        row_2: {
          value: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`,
          label: '时间',
          unit: '',
          detail: '',
          color: '#00FFFF',
          icon: 'I',
        },
        row_3: {
          value: `${String(date.getFullYear()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
          label: '日期',
          unit: '',
          detail: '',
          color: '#FFFF00',
          icon: 'I',
        },
        row_4: {
          value: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`,
          label: '时间',
          unit: '',
          detail: '',
          color: '#00FFFF',
          icon: 'I',
        },
      };

      return this.monitorData;

    }

    formatDisplayText(key, showIcon = false) {
      if (!this.monitorData[key]) {
        return '';
      }

      const item = this.monitorData[key];
      const iconPart = showIcon ? `[${item.icon}] ` : '';
      const detailPart = item.detail || '';
      if (detailPart) {
        return `${iconPart}${item.label}: ${item.value}${item.unit} ${detailPart}`;
      } else {
        return `${iconPart}${item.label}: ${item.value}${item.unit}`;
      }
    }

    rgb565ToRgb(color565) {
      const r = ((color565 >> 11) & 0x1F) << 3;
      const g = ((color565 >> 5) & 0x3F) << 2;
      const b = (color565 & 0x1F) << 3;
      return [r, g, b];
    }

    hexToRgb(hexColor) {
      if (typeof hexColor === 'number') {
        return this.rgb565ToRgb(hexColor);
      }

      if (typeof hexColor === 'string' && hexColor.startsWith('#')) {
        const hex = hexColor.slice(1);

        if (hex.length === 3) {
          const r = parseInt(hex[0] + hex[0], 16);
          const g = parseInt(hex[1] + hex[1], 16);
          const b = parseInt(hex[2] + hex[2], 16);
          return [r, g, b];
        } else if (hex.length === 6) {
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          return [r, g, b];
        }
      }

      return [255, 255, 255];
    }

    createDisplayImage() {
      this.collectSystemData();

      // 清空画布
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, SHOW_WIDTH, SHOW_HEIGHT);

      // 绘制网格布局
      this.drawGridLayout();

      return canvas;
    }

    drawGridLayout() {
      const layouts = [
        { key: 'row_1', position: [10, 10] },
        { key: 'row_2', position: [10, 50] },
        { key: 'row_3', position: [10, 90] },
        { key: 'row_4', position: [10, 130] },
      ];

      ctx.font = this.font;
      ctx.textBaseline = 'top';

      layouts.forEach(layout => {
        if (this.monitorData[layout.key]) {
          const item = this.monitorData[layout.key];
          const text = this.formatDisplayText(layout.key, false);
          const color = this.hexToRgb(item['color']);
          ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
          ctx.fillText(text, layout.position[0], layout.position[1]);
        }
      });
    }
  }

  // 创建全局监控器实例
  const monitor = new SystemMonitor();

  // 连接按钮点击事件
  connectButton.addEventListener('click', async () => {
    try {
      // 请求用户授权访问串口设备
      port = await navigator.serial.requestPort();

      // 打开串口，设置波特率为 19200（与 Python 脚本一致）
      await port.open({
        baudRate: 19200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });

      // 获取读写器
      const encoder = new TextEncoder();
      const decoder = new TextDecoder('gbk');
      writer = port.writable.getWriter();
      reader = port.readable.getReader();

      // 开始监听串口数据
      listenForData(reader, decoder);

      // 发送连接确认消息
      await sendMessage('MSNCN');

      console.log('MSN设备连接中...');

      // 连接成功后自动开始监控
      setTimeout(() => {
        if (!animationId) {
          console.log('自动开始监控...');
          animationId = requestAnimationFrame(animate);
        }
      }, 200);

    } catch (error) {
      console.error('连接设备时出错:', error);
    }
  });

  // 监听串口数据
  async function listenForData(reader, decoder) {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          // 端口已关闭
          console.log('串口已关闭');
          deviceState = 0;
          break;
        }

        // 处理接收到的数据
        const data = decoder.decode(value);
        console.log('接收到数据:', data);

        // 检测是否为 MSN 设备
        if (data.length > 5) {
          for (let n = 0; n < data.length - 5; n++) {
            if (data.charCodeAt(n) === 0) {
              if (data.substring(n + 1, n + 4) === 'MSN') {
                // 确认是 MSN 设备
                console.log('检测到 MSN 设备');
                deviceState = 1;

                // 检查是否收到连接确认
                if (data.substring(n + 1, n + 6) === 'MSNCN') {
                  console.log('MSN 设备连接完成');
                }
                break;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('读取数据时出错:', error);
      deviceState = 0;
    }
  }

  // 发送消息到设备
  async function sendMessage(message) {
    if (!writer) return;

    try {
      // 构建消息：开头是 0x00，然后是消息内容
      const data = new Uint8Array(message.length + 1);
      data[0] = 0x00; // 开头的 0 字节
      for (let i = 0; i < message.length; i++) {
        data[i + 1] = message.charCodeAt(i);
      }

      await writer.write(data);
      console.log('发送消息:', message);
    } catch (error) {
      console.error('发送消息时出错:', error);
    }
  }

  // 断开连接按钮点击事件
  disconnectButton.addEventListener('click', async () => {
    // 断开连接前自动停止监控
    if (animationId) {
      console.log('自动停止监控...');
      cancelAnimationFrame(animationId);
      animationId = null;
    }

    if (reader) {
      await reader.cancel();
      reader.releaseLock();
    }

    if (writer) {
      await writer.close();
      writer.releaseLock();
    }

    if (port) {
      await port.close();
      port = null;
    }

    deviceState = 0;
    console.log('设备已断开连接');
  });

  // 辅助函数：将32位整数拆分为4个字节
  function digitToInts(di) {
    return [(di >> 24) & 0xFF, (di >> 16) & 0xFF, (di >> 8) & 0xFF, di & 0xFF];
  }

  // RGB888转RGB565格式
  function rgb888ToRgb565(imageData) {
    const rgb565Array = [];
    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];

      const rgb565 = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
      rgb565Array.push(rgb565);
    }
    return rgb565Array;
  }

  // 对图像数据进行压缩处理，减少传输数据量
  function ScreenDateProcess(photoData) {
    const totalDataSize = photoData.length;
    const dataPerPage = 128;
    let dataPage1 = 0;
    let dataPage2 = 0;
    const hexUse = [];

    // 按页处理数据
    for (let i = 0; i < Math.floor(totalDataSize / dataPerPage); i++) {
      dataPage1 = dataPage2;
      dataPage2 += dataPerPage;
      const dataW = photoData.slice(dataPage1, dataPage2);
      const cmpUse = [];
      for (let j = 0; j < dataW.length; j += 2) {
        cmpUse.push((dataW[j] << 16) | dataW[j + 1]);
      }

      // 找出最频繁的颜色作为背景色
      const colorCount = {};
      cmpUse.forEach(color => {
        colorCount[color] = (colorCount[color] || 0) + 1;
      });
      let maxCount = 0;
      let backgroundColor = 0;
      for (const [color, count] of Object.entries(colorCount)) {
        if (count > maxCount) {
          maxCount = count;
          backgroundColor = parseInt(color);
        }
      }

      hexUse.push(2, 4);
      hexUse.push(...digitToInts(backgroundColor));

      // 只记录与背景色不同的像素
      cmpUse.forEach((cmpValue, index) => {
        if (cmpValue !== backgroundColor) {
          hexUse.push(4, index);
          hexUse.push(...digitToInts(cmpValue));
        }
      });

      hexUse.push(2, 3, 8, 1, 0, 0);
    }

    // 处理剩余数据
    const remainingDataSize = totalDataSize % dataPerPage;
    if (remainingDataSize !== 0) {
      const dataW = photoData.slice(-remainingDataSize);
      // 补全数据
      while (dataW.length < dataPerPage) {
        dataW.push(0xFFFF);
      }
      const cmpUse = [];
      for (let j = 0; j < dataW.length; j += 2) {
        cmpUse.push((dataW[j] << 16) | dataW[j + 1]);
      }
      cmpUse.forEach((cmpValue, index) => {
        hexUse.push(4, index);
        hexUse.push(...digitToInts(cmpValue));
      });
      hexUse.push(2, 3, 8, 0, remainingDataSize * 2, 0);
    }
    return hexUse;
  }

  // 设置LCD显示起始坐标
  function LCD_Set_XY(lcdD0, lcdD1) {
    const hexUse = [];
    hexUse.push(2); // LCD多次写入命令
    hexUse.push(0); // 设置起始位置指令
    hexUse.push(Math.floor(lcdD0 / 256)); // X坐标高字节
    hexUse.push(lcdD0 % 256);   // X坐标低字节
    hexUse.push(Math.floor(lcdD1 / 256)); // Y坐标高字节
    hexUse.push(lcdD1 % 256);   // Y坐标低字节
    return hexUse;
  }

  // 设置LCD显示区域大小
  function LCD_Set_Size(lcdD0, lcdD1) {
    const hexUse = [];
    hexUse.push(2); // LCD多次写入命令
    hexUse.push(1); // 设置大小指令
    hexUse.push(Math.floor(lcdD0 / 256)); // 宽度高字节
    hexUse.push(lcdD0 % 256);   // 宽度低字节
    hexUse.push(Math.floor(lcdD1 / 256)); // 高度高字节
    hexUse.push(lcdD1 % 256);   // 高度低字节
    return hexUse;
  }

  // 设置LCD显示区域并准备写入数据
  async function LCD_ADD(lcdX, lcdY, lcdXSize, lcdYSize) {
    const hexUse = [];
    hexUse.push(...LCD_Set_XY(lcdX, lcdY));
    hexUse.push(...LCD_Set_Size(lcdXSize, lcdYSize));
    hexUse.push(2); // LCD多次写入命令
    hexUse.push(3); // 设置指令
    hexUse.push(7); // 载入地址
    hexUse.push(0, 0, 0);

    await sendData(hexUse);
  }

  // 发送数据到设备
  async function sendData(dataArray) {
    if (!writer) return;

    try {
      const data = new Uint8Array(dataArray);
      await writer.write(data);
      console.log('发送数据:', dataArray.length, '字节');
    } catch (error) {
      console.error('发送数据时出错:', error);
    }
  }

  // 显示系统状态到LCD屏幕
  async function showPCState() {
    // 创建显示图像
    const image = monitor.createDisplayImage();

    // 获取图像数据
    const imageData = ctx.getImageData(0, 0, SHOW_WIDTH, SHOW_HEIGHT);

    // 转换为RGB565格式
    const rgb565 = rgb888ToRgb565(imageData);

    // 压缩数据
    const hexUse = ScreenDateProcess(rgb565);

    // 发送数据到设备
    await sendData(hexUse);
  }

  // 动画循环
  async function animate(timestamp) {
    if (!lastRefreshTime) {
      lastRefreshTime = timestamp;
    }

    const elapsed = timestamp - lastRefreshTime;
    if (elapsed >= refreshInterval) {
      lastRefreshTime = timestamp;

      // 检查设备状态
      if (deviceState === 1) {
        try {
          // 设置显示区域
          await LCD_ADD(0, 0, SHOW_WIDTH, SHOW_HEIGHT);

          // 显示系统状态
          await showPCState();
        } catch (error) {
          console.error('显示系统状态时出错:', error);
        }
      }
    }

    // 继续动画循环
    animationId = requestAnimationFrame(animate);
  }

  // 开始按钮点击事件
  startButton.addEventListener('click', () => {
    if (!animationId) {
      console.log('开始监控...');
      animationId = requestAnimationFrame(animate);
    }
  });

  // 停止按钮点击事件
  stopButton.addEventListener('click', () => {
    if (animationId) {
      console.log('停止监控...');
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  });

});
