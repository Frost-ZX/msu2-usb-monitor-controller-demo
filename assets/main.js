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
  let refreshInterval = 100; // 刷新间隔（毫秒）
  let animationId = null;
  let lastRefreshTime = 0;
  let displayMode = 'data'; // 显示模式: 'data' 或 'spectrum'

  // 音频相关变量
  let audioContext = null;
  let analyser = null;
  let microphone = null;
  let dataArray = null;
  let bufferLength = null;
  let isMicrophoneActive = false;

  // 显示参数
  let SHOW_WIDTH = 320; // Canvas 显示宽度（用于网页显示）
  let SHOW_HEIGHT = 240; // Canvas 显示高度（用于网页显示）
  let LCD_X = 160; // 设备实际宽度
  let LCD_Y = 80; // 设备实际高度

  // 分辨率选项配置
  const RESOLUTIONS = {
    '160x80': { showWidth: 320, showHeight: 240, lcdX: 160, lcdY: 80 },
    '320x172': { showWidth: 320, showHeight: 240, lcdX: 320, lcdY: 172 },
    '320x240': { showWidth: 320, showHeight: 240, lcdX: 320, lcdY: 240 }
  };

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
      ctx.textAlign = 'left';

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

  // 初始化音频上下文和麦克风
  async function initAudio() {
    try {
      // 创建音频上下文
      audioContext = new (window.AudioContext || window.webkitAudioContext)();

      // 请求麦克风访问
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 创建麦克风源
      microphone = audioContext.createMediaStreamSource(stream);

      // 创建分析器
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.25;

      // 连接麦克风到分析器
      microphone.connect(analyser);

      // 获取分析器数据
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);

      isMicrophoneActive = true;
      console.log('麦克风初始化成功');
    } catch (error) {
      console.error('初始化音频时出错:', error);
      isMicrophoneActive = false;
    }
  }

  // 停止音频分析
  function stopAudio() {
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    if (microphone) {
      microphone.disconnect();
      microphone = null;
    }
    if (analyser) {
      analyser.disconnect();
      analyser = null;
    }
    isMicrophoneActive = false;
    console.log('音频分析已停止');
  }

  // 绘制频谱
  function drawSpectrum() {
    // 清空画布
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, SHOW_WIDTH, SHOW_HEIGHT);

    if (!isMicrophoneActive || !analyser) {
      ctx.fillStyle = 'white';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('麦克风未初始化', SHOW_WIDTH / 2, SHOW_HEIGHT / 2);
      return;
    }

    // 获取频谱数据
    analyser.getByteFrequencyData(dataArray);

    // 计算柱状图宽度和间距
    const barWidth = (SHOW_WIDTH / bufferLength) * 2.5;
    let x = 0;

    // 绘制频谱柱状图
    for (let i = 0; i < bufferLength; i++) {
      // 计算柱状图高度
      const barHeight = (dataArray[i] / 255) * SHOW_HEIGHT;

      // 生成渐变颜色
      const r = Math.floor((i / bufferLength) * 255);
      const g = Math.floor((dataArray[i] / 255) * 255);
      const b = 150;

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

      // 绘制柱状图
      ctx.fillRect(x, SHOW_HEIGHT - barHeight, barWidth, barHeight);

      // 移动到下一个柱状图位置
      x += barWidth + 1;
    }
  }

  // 分辨率选择事件监听器
  const resolutionSelect = document.getElementById('resolution');

  resolutionSelect.addEventListener('change', (e) => {

    const selectedResolution = e.target.value;
    const resolutionConfig = RESOLUTIONS[selectedResolution];

    // 更新显示参数
    SHOW_WIDTH = resolutionConfig.showWidth;
    SHOW_HEIGHT = resolutionConfig.showHeight;
    LCD_X = resolutionConfig.lcdX;
    LCD_Y = resolutionConfig.lcdY;

    // 更新Canvas尺寸
    canvas.width = SHOW_WIDTH;
    canvas.height = SHOW_HEIGHT;

    // 重新创建显示图像
    if (displayMode === 'data') {
      monitor.createDisplayImage();
    } else {
      drawSpectrum();
    }

    // 显示信息
    console.log(`分辨率已切换至: ${selectedResolution}`);

  });

  // 显示模式选择事件监听器
  const displayModeSelect = document.getElementById('display-mode');

  displayModeSelect.addEventListener('change', (e) => {

    displayMode = e.target.value;

    // 重新创建显示图像
    if (displayMode === 'data') {
      monitor.createDisplayImage();
    } else {
      // 如果切换到频谱模式，初始化麦克风
      if (!isMicrophoneActive) {
        initAudio();
      }
      drawSpectrum();
    }

    // 显示信息
    console.log(`显示模式已切换至: ${displayMode === 'data' ? '文本数据' : '频谱分析'}`);

  });

  // 连接按钮点击事件
  connectButton.addEventListener('click', async () => {
    try {
      // 请求用户授权访问串口设备
      port = await navigator.serial.requestPort();

      // 打开串口
      await port.open({
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'hardware',
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
          console.log('自动开始...');
          animationId = requestAnimationFrame(animate);
        }
      }, 100);

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
        console.debug('接收数据:', data);

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
      console.debug('发送数据:', message);
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
  // 基于 compaction.c 中的 MSN_compaction 算法移植
  function ScreenDateProcess(photoData) {
    const totalDataSize = photoData.length;
    const dataPerPage = 128;
    const hexUse = [];
    let dataIndex = 0;

    // 按页处理数据（每页128个像素）
    const totalPages = Math.floor(totalDataSize / dataPerPage);
    for (let page = 0; page < totalPages; page++) {
      let i = 0;
      while (i < 128) {
        let a = 0;
        let a_data = photoData[dataIndex];

        // 统计第一种颜色的连续出现次数（最多15次）
        for (let s = 0; s < 15; s++) {
          if (i < 128 && a_data === photoData[dataIndex]) {
            a++;
            i++;
            dataIndex++;
          } else {
            break;
          }
        }

        let b = 0;
        let b_data = 0;

        // 统计第二种颜色的连续出现次数（最多15次）
        if (i < 128) {
          b_data = photoData[dataIndex];
          for (let s = 0; s < 15; s++) {
            if (i < 128 && b_data === photoData[dataIndex]) {
              b++;
              i++;
              dataIndex++;
            } else {
              break;
            }
          }
        }

        // 输出压缩数据：[9, a*16+b, a_data高字节, a_data低字节, b_data高字节, b_data低字节]
        hexUse.push(9);
        hexUse.push(a * 16 + b);
        hexUse.push((a_data >> 8) & 0xFF);
        hexUse.push(a_data & 0xFF);
        hexUse.push((b_data >> 8) & 0xFF);
        hexUse.push(b_data & 0xFF);
      }
    }

    // 处理剩余数据
    const remainingDataSize = totalDataSize % dataPerPage;
    if (remainingDataSize !== 0) {
      const remainingData = photoData.slice(totalDataSize - remainingDataSize);

      // 补全数据到128字节
      while (remainingData.length < dataPerPage) {
        remainingData.push(0xFFFF);
      }

      let i = 0;
      let dataIndex = 0;
      while (i < 128) {
        let a = 0;
        let a_data = remainingData[dataIndex];

        for (let s = 0; s < 15; s++) {
          if (i < 128 && a_data === remainingData[dataIndex]) {
            a++;
            i++;
            dataIndex++;
          } else {
            break;
          }
        }

        let b = 0;
        let b_data = 0;

        if (i < 128) {
          b_data = remainingData[dataIndex];
          for (let s = 0; s < 15; s++) {
            if (i < 128 && b_data === remainingData[dataIndex]) {
              b++;
              i++;
              dataIndex++;
            } else {
              break;
            }
          }
        }

        hexUse.push(9);
        hexUse.push(a * 16 + b);
        hexUse.push((a_data >> 8) & 0xFF);
        hexUse.push(a_data & 0xFF);
        hexUse.push((b_data >> 8) & 0xFF);
        hexUse.push(b_data & 0xFF);
      }
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
      console.debug('发送数据:', dataArray.length, '字节');
    } catch (error) {
      console.error('发送数据时出错:', error);
    }
  }

  // 显示系统状态到LCD屏幕
  async function showPCState() {
    // 创建显示图像
    const image = monitor.createDisplayImage();

    // 创建一个临时Canvas用于图像缩放
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = LCD_X;
    tempCanvas.height = LCD_Y;
    const tempCtx = tempCanvas.getContext('2d');

    // 将原始Canvas内容缩放到设备实际分辨率
    tempCtx.drawImage(canvas, 0, 0, LCD_X, LCD_Y);

    // 获取缩放后的图像数据
    const imageData = tempCtx.getImageData(0, 0, LCD_X, LCD_Y);

    // 转换为RGB565格式
    const rgb565 = rgb888ToRgb565(imageData);

    // 压缩数据
    const hexUse = ScreenDateProcess(rgb565);

    // 发送数据到设备
    await sendData(hexUse);
  }

  // 显示频谱到LCD屏幕
  async function showFrequencySpectrum() {
    // 绘制频谱
    drawSpectrum();

    // 创建一个临时Canvas用于图像缩放
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = LCD_X;
    tempCanvas.height = LCD_Y;
    const tempCtx = tempCanvas.getContext('2d');

    // 将原始Canvas内容缩放到设备实际分辨率
    tempCtx.drawImage(canvas, 0, 0, LCD_X, LCD_Y);

    // 获取缩放后的图像数据
    const imageData = tempCtx.getImageData(0, 0, LCD_X, LCD_Y);

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
          await LCD_ADD(0, 0, LCD_X, LCD_Y);

          // 根据显示模式选择要显示的内容
          if (displayMode === 'spectrum') {
            // 如果是频谱模式但麦克风未初始化，则初始化麦克风
            if (!isMicrophoneActive) {
              await initAudio();
            }
            await showFrequencySpectrum();
          } else {
            await showPCState();
          }
        } catch (error) {
          console.error('显示内容时出错:', error);
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
