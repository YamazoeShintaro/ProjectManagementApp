import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Project, WBSTask, ProjectMember } from '../types/index';

// 日本語フォントの設定
const configureFontsForPDF = (pdf: jsPDF) => {
  try {
    pdf.setFont('helvetica');
    pdf.setFontSize(12);
  } catch (error) {
    console.warn('フォント設定エラー:', error);
  }
};

// WBSガントチャートのPDF出力（タスクバー込み完全版）
export const exportWBSToPDF = async (
  element: HTMLElement,
  options: {
    title?: string;
    project?: Project;
    orientation?: 'portrait' | 'landscape';
    format?: string;
  } = {}
) => {
  try {
    const {
      title = 'WBS Gantt Chart',
      project,
      orientation = 'landscape',
      format = 'a3'
    } = options;

    console.log('PDF出力開始（タスクバー対応版）...');

    // ガントチャートコンテナを取得（elementそのものがdata-pdf-export属性を持つ場合）
    const ganttContainer = element.hasAttribute && element.hasAttribute('data-pdf-export') 
      ? element 
      : element.querySelector('[data-pdf-export="gantt-chart"]') as HTMLElement;
    
    if (!ganttContainer) {
      console.error('ガントチャートコンテナが見つかりません。element:', element);
      throw new Error('ガントチャートコンテナが見つかりません');
    }

    // PDF出力用の複製コンテナを作成
    const pdfContainer = document.createElement('div');
    pdfContainer.style.cssText = `
      position: absolute;
      top: -99999px;
      left: -99999px;
      background: white;
      z-index: -9999;
    `;

    // ガントチャートを深くクローン
    const clonedChart = ganttContainer.cloneNode(true) as HTMLElement;
    
    // クローンのスタイルを調整
    clonedChart.style.cssText = `
      position: relative;
      width: auto;
      height: auto;
      overflow: visible !important;
      display: block;
      background: white;
      border: 1px solid #e0e0e0;
    `;

    // スクロール可能な要素をすべて展開
    const scrollableElements = clonedChart.querySelectorAll('*');
    scrollableElements.forEach(el => {
      const htmlEl = el as HTMLElement;
      if (htmlEl.style) {
        // オーバーフローを表示
        if (htmlEl.style.overflow || htmlEl.style.overflowX || htmlEl.style.overflowY) {
          htmlEl.style.overflow = 'visible';
          htmlEl.style.overflowX = 'visible';
          htmlEl.style.overflowY = 'visible';
        }
        // 高さ制限を解除
        if (htmlEl.style.height && htmlEl.style.height !== 'auto') {
          htmlEl.style.height = 'auto';
        }
        if (htmlEl.style.maxHeight) {
          htmlEl.style.maxHeight = 'none';
        }
        // position: stickyやfixedを解除
        if (htmlEl.style.position === 'sticky' || htmlEl.style.position === 'fixed') {
          htmlEl.style.position = 'relative';
        }
      }
    });

    // タスクバー（絶対配置要素）の処理
    // 右側のボディコンテナを探す
    const bodyContainer = clonedChart.children[2] as HTMLElement; // ボディ部分
    if (bodyContainer) {
      const rightBody = bodyContainer.children[1] as HTMLElement; // 右側スクロール部分
      if (rightBody) {
        // 全体のコンテナサイズを取得
        const timelineContainer = rightBody.querySelector('div > div') as HTMLElement;
        if (timelineContainer) {
          // 元のサイズを保持しつつ、内容を表示
          timelineContainer.style.position = 'relative';
          timelineContainer.style.overflow = 'visible';
          
          // すべての子要素（タスク行）の絶対配置を確保
          const taskRows = timelineContainer.children;
          Array.from(taskRows).forEach((row, index) => {
            const htmlRow = row as HTMLElement;
            // 各行のスタイルを確保
            if (htmlRow.style.position === 'absolute') {
              // 絶対配置のスタイルは維持
              htmlRow.style.position = 'absolute';
            }
            
            // タスクバー（塗りつぶし部分）の確認
            const taskCells = htmlRow.children;
            Array.from(taskCells).forEach(cell => {
              const htmlCell = cell as HTMLElement;
              // 背景色が設定されているセルは維持
              if (htmlCell.style.backgroundColor && 
                  htmlCell.style.backgroundColor !== 'transparent' &&
                  htmlCell.style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
                // タスクバーのスタイルを保持
                htmlCell.style.position = 'absolute';
                htmlCell.style.zIndex = '5';
              }
            });
          });
        }
      }
    }

    pdfContainer.appendChild(clonedChart);
    document.body.appendChild(pdfContainer);

    // レンダリング待機
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('キャプチャ開始...');

    // html2canvasでキャプチャ
    const canvas = await html2canvas(clonedChart, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: clonedChart.scrollWidth + 500,
      windowHeight: clonedChart.scrollHeight + 500,
      scrollX: 0,
      scrollY: 0,
      foreignObjectRendering: false,
      // 重要: 絶対配置要素を含める
      onclone: (clonedDoc, element) => {
        // クローンされた要素内の絶対配置要素を確実に表示
        const absoluteElements = element.querySelectorAll('[style*="position: absolute"]');
        absoluteElements.forEach(el => {
          const htmlEl = el as HTMLElement;
          // z-indexを確保
          if (!htmlEl.style.zIndex) {
            htmlEl.style.zIndex = '10';
          }
        });
      }
    });

    console.log(`キャプチャ完了: ${canvas.width}x${canvas.height}px`);

    // 一時要素を削除
    document.body.removeChild(pdfContainer);

    // PDF作成
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'mm',
      format: format
    });

    // 日本語フォント設定
    configureFontsForPDF(pdf);

    // ページサイズ取得
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // タイトルとプロジェクト情報を追加
    pdf.setFontSize(16);
    pdf.text(title, 20, 20);
    
    if (project) {
      pdf.setFontSize(10);
      let yPos = 30;
      if (project.client_name) {
        pdf.text(`Client: ${project.client_name}`, 20, yPos);
        yPos += 5;
      }
      if (project.start_date && project.end_date) {
        pdf.text(`Period: ${project.start_date} - ${project.end_date}`, 20, yPos);
        yPos += 5;
      }
    }

    // キャンバスの画像をPDFに追加
    const imgWidth = pageWidth - 40; // 左右20mmずつの余白
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let yPosition = 45; // ヘッダー下の位置
    const maxHeightPerPage = pageHeight - 60; // 上下の余白を考慮

    if (imgHeight <= maxHeightPerPage) {
      // 1ページに収まる場合
      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        20,
        yPosition,
        imgWidth,
        imgHeight
      );
    } else {
      // 複数ページに分割する場合
      let remainingHeight = imgHeight;
      let currentY = 0;
      let pageNumber = 1;

      while (remainingHeight > 0) {
        if (pageNumber > 1) {
          pdf.addPage();
          yPosition = 20;
        }

        const currentPageHeight = Math.min(remainingHeight, maxHeightPerPage);
        
        // 部分的なキャンバスを作成
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d')!;
        
        // ソース画像の部分を計算
        const sourceY = (currentY * canvas.height) / imgHeight;
        const sourceHeight = (currentPageHeight * canvas.height) / imgHeight;
        
        tempCanvas.width = canvas.width;
        tempCanvas.height = sourceHeight;
        
        tempCtx.drawImage(
          canvas,
          0, sourceY,
          canvas.width, sourceHeight,
          0, 0,
          canvas.width, sourceHeight
        );
        
        pdf.addImage(
          tempCanvas.toDataURL('image/png'),
          'PNG',
          20,
          yPosition,
          imgWidth,
          currentPageHeight
        );
        
        currentY += currentPageHeight;
        remainingHeight -= currentPageHeight;
        pageNumber++;
      }
    }

    // フッターを各ページに追加
    const getTotalPages = (): number => {
      const pdfAny = pdf as any;
      if (pdfAny.internal && pdfAny.internal.pages) {
        // jsPDF v2.x のページ数取得方法
        return Object.keys(pdfAny.internal.pages).length - 1;
      } else if (typeof pdfAny.getNumberOfPages === 'function') {
        // 古いバージョンの場合
        return pdfAny.getNumberOfPages();
      }
      return 1;
    };
    
    const totalPages = getTotalPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      const footerText = `Generated: ${new Date().toLocaleString('ja-JP')} - Page ${i} of ${totalPages}`;
      pdf.text(footerText, 20, pageHeight - 10);
    }

    // PDFダウンロード
    const fileName = project 
      ? `${project.project_name.replace(/[^\w\s-]/g, '')}_WBS_${new Date().toISOString().split('T')[0]}.pdf`
      : `WBS_Gantt_${new Date().toISOString().split('T')[0]}.pdf`;
      
    pdf.save(fileName);

    console.log('PDF出力完了:', fileName);

  } catch (error) {
    console.error('PDF出力エラー:', error);
    throw new Error(`PDF出力に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
  }
};

// 文字エンコーディング対応のヘルパー関数
export const encodeTextForPDF = (text: string): string => {
  return text.replace(/[^\x20-\x7E]/g, (char) => {
    return char;
  });
};