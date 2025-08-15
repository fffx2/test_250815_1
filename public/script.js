// 파일 위치: public/script.js

class ErrorHandler {
    static handle(error, context = '작업') {
        console.error(`[${context} 오류]`, error);
        alert(`${context} 중 오류 발생: ${error.message}`);
    }
}

class OpenAIService {
    static async #callNetlifyFunction(prompt) {
        try {
            const response = await fetch('/.netlify/functions/getOpenAiResult', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt })
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`서버 응답 오류: ${response.status} ${response.statusText}. 내용: ${errorText}`);
            }
            const data = await response.json();
            return data.result;
        } catch (error) {
            ErrorHandler.handle(error, 'AI 서비스 통신');
            throw error;
        }
    }

    static async generateGuide(inputs) {
        const prompt = `
            당신은 한국 시장을 잘 이해하는 시니어 UX/UI 디자이너입니다. 사용자가 입력한 아래 조건에 맞춰 웹 디자인 시스템을 한국어로 제안해주세요. 제안하는 모든 색상은 배경으로 사용될 때 흰색(#FFFFFF) 또는 검은색(#000000) 글씨와 함께 WCAG AA 등급 이상의 명도 대비를 만족해야 합니다.
            사용자 입력 조건:
            - 서비스 목적: ${inputs.purpose}
            - 대상 연령: ${inputs.age}
            - 핵심 키워드: ${inputs.keywords}
            - 원하는 분위기: ${inputs.mood}
            아래의 JSON 스키마를 완벽하게 준수하여 응답해야 합니다.
            {
              "fontSystem": { "category": "Sans-serif 또는 Serif", "headline": { "fontFamily": "Google Fonts 이름", "fontSize": "32px", "fontWeight": "700" }, "body": { "fontFamily": "Google Fonts 이름", "fontSize": "16px", "fontWeight": "400" }, "caption": { "fontFamily": "Google Fonts 이름", "fontSize": "12px", "fontWeight": "400" }, "guideline": "이 폰트 조합이 왜 해당 컨셉에 적합한지에 대한 1-2문장의 짧은 설명." },
              "colorSystem": [ { "hex": "#RRGGBB", "name": "메인 컬러 이름", "usage": "용도 설명." }, { "hex": "#RRGGBB", "name": "보조 컬러 이름", "usage": "용도 설명." } ],
              "grayscaleSystem": ["#212529", "#495057", "#868e96", "#ced4da", "#f8f9fa"]
            }
        `;
        const rawJsonResult = await this.#callNetlifyFunction(prompt);
        return JSON.parse(rawJsonResult);
    }

    static async getChatReply(messages) {
        const systemMessage = `당신은 실용적인 조언을 하는 UI/UX 디자인 전문가입니다. 사용자의 질문에 대해 핵심만 간결하게 답변해주세요. 다음 원칙을 반드시 지켜주세요: 1. 답변은 항상 6줄 이내로 작성합니다. 2. 전문가적이지만 친절한 말투를 사용합니다. 3. 마크다운(**, *, # 등)을 사용하지 않고, 순수 텍스트로만 답변합니다.`;
        const chatHistoryString = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const prompt = `${systemMessage}\n\n[대화 기록]\n${chatHistoryString}\n\n[마지막 질문]\n${messages[messages.length-1].content}`;
        const reply = await this.#callNetlifyFunction(prompt);
        return reply.replace(/\*\*(.*?)\*\*/g, '$1');
    }
}

class TypographyAnalyzer {
    constructor() { this.wcagRules = { contrastRatio: 4.5, minFontSize: 16, minLineHeight: 1.5 }; }
    analyze(iframeDoc) {
        const elementsWithIssues = []; const uniqueFonts = new Set(); const uniqueColors = new Set();
        iframeDoc.querySelectorAll('h1, h2, h3, h4, p, a, li, span, div').forEach(el => {
            if (!el.textContent.trim() || el.offsetWidth === 0) return;
            const computedStyle = iframeDoc.defaultView.getComputedStyle(el);
            uniqueFonts.add(computedStyle.fontFamily); uniqueColors.add(computedStyle.color);
            const analysis = { domElement: el, issues: [] };
            this.checkCompliance(analysis, computedStyle);
            if (analysis.issues.length > 0) elementsWithIssues.push(analysis);
        });
        return { elements: elementsWithIssues, consistency: { fontCount: uniqueFonts.size, colorCount: uniqueColors.size } };
    }
    checkCompliance(analysis, style) {
        const fontSize = parseFloat(style.fontSize);
        if (fontSize < this.wcagRules.minFontSize) analysis.issues.push({ type: 'fontSize', message: `권장 크기(${this.wcagRules.minFontSize}px)보다 작습니다.` });
        const contrast = this.getContrast(style.color, this.getRealBackgroundColor(analysis.domElement, analysis.domElement.ownerDocument.defaultView));
        if (contrast < this.wcagRules.contrastRatio) analysis.issues.push({ type: 'contrast', message: `명도 대비가 WCAG AA 기준(${this.wcagRules.contrastRatio}:1)에 미달합니다.` });
        const lineHeight = parseFloat(style.lineHeight);
        if (!isNaN(lineHeight) && (lineHeight / fontSize) < this.wcagRules.minLineHeight) analysis.issues.push({ type: 'lineHeight', message: `줄 간격이 권장 비율(${this.wcagRules.minLineHeight})보다 좁습니다.` });
    }
    getRealBackgroundColor = (element, view) => { let current = element; while (current) { const bgColor = view.getComputedStyle(current).backgroundColor; if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') return bgColor; if (current.tagName.toLowerCase() === 'body') break; current = current.parentElement; } return 'rgb(255, 255, 255)'; }
    getLuminance(color) { const rgb = this.parseColor(color); const a = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722; }
    getContrast(color1, color2) { const lum1 = this.getLuminance(color1); const lum2 = this.getLuminance(color2); return (Math.max(lum1, lum2) + 0.05) / (Math.min(lum1, lum2) + 0.05); }
    parseColor(colorStr) { const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [0, 0, 0]; }
    getWCAGRating(contrast) { if (contrast >= 7) return 'AAA'; if (contrast >= 4.5) return 'AA'; return 'Fail'; }
    rgbToHex(rgbStr) { const [r, g, b] = this.parseColor(rgbStr); return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase(); }
}

class TypoLab {
    constructor() {
        this.cacheDOMElements();
        this.analyzer = new TypographyAnalyzer();
        this.chatHistory = [];
        this.initializeEventListeners();
        this.updateAgeRangeSlider(); // ✅ 앱 시작 시 슬라이더 초기화
    }
    cacheDOMElements() {
        this.dom = {
            tabBtns: document.querySelectorAll('.tab-btn'),
            pages: document.querySelectorAll('.tab-content'),
            generateGuideBtn: document.getElementById('generateGuideBtn'),
            guideResultSection: document.getElementById('guideResults'),
            // ✅ 수정된 슬라이더 요소들
            ageRangeMin: document.getElementById('ageRangeMin'),
            ageRangeMax: document.getElementById('ageRangeMax'),
            sliderRange: document.getElementById('sliderRange'),
            ageDisplay: document.getElementById('ageDisplay'),
            fileInput: document.getElementById('fileInput'),
            uploadArea: document.getElementById('uploadArea'),
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            analyzeBtn: document.getElementById('analyzeBtn'),
            analysisResults: document.getElementById('analysisResults'),
            chatMessages: document.getElementById('chatMessages'),
            chatInput: document.getElementById('chatInput'),
            sendChatBtn: document.getElementById('sendChatBtn'),
            loadingOverlay: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
        };
    }
    initializeEventListeners() {
        this.dom.tabBtns.forEach(btn => btn.addEventListener('click', () => this.switchTab(btn.dataset.tab)));
        this.dom.generateGuideBtn.addEventListener('click', () => this.generateGuide());
        // ✅ 수정된 슬라이더 이벤트 리스너
        this.dom.ageRangeMin.addEventListener('input', () => this.updateAgeRangeSlider());
        this.dom.ageRangeMax.addEventListener('input', () => this.updateAgeRangeSlider());
        this.dom.uploadArea.addEventListener('click', () => this.dom.fileInput.click());
        this.dom.fileInput.addEventListener('change', e => this.handleFile(e.target.files[0]));
        this.dom.uploadArea.addEventListener('dragover', e => { e.preventDefault(); this.dom.uploadArea.classList.add('dragover'); });
        this.dom.uploadArea.addEventListener('dragleave', () => this.dom.uploadArea.classList.remove('dragover'));
        this.dom.uploadArea.addEventListener('drop', e => { e.preventDefault(); this.dom.uploadArea.classList.remove('dragover'); this.handleFile(e.dataTransfer.files[0]); });
        this.dom.analyzeBtn.addEventListener('click', () => this.runAnalysis());
        this.dom.sendChatBtn.addEventListener('click', () => this.sendChatMessage());
        this.dom.chatInput.addEventListener('keypress', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendChatMessage(); } });
    }

    // ✅ 새로운 연령 범위 슬라이더 업데이트 함수
    updateAgeRangeSlider() {
        let minVal = parseInt(this.dom.ageRangeMin.value);
        let maxVal = parseInt(this.dom.ageRangeMax.value);

        // 두 핸들이 겹치지 않도록 보정
        if (maxVal < minVal + 5) {
            if (event.target.id === "ageRangeMin") {
                this.dom.ageRangeMin.value = maxVal - 5;
                minVal = maxVal - 5;
            } else {
                this.dom.ageRangeMax.value = minVal + 5;
                maxVal = minVal + 5;
            }
        }

        const min = this.dom.ageRangeMin.min;
        const max = this.dom.ageRangeMin.max;
        
        // 슬라이더 사이의 색상 채우기
        this.dom.sliderRange.style.left = ((minVal - min) / (max - min)) * 100 + '%';
        this.dom.sliderRange.style.right = 100 - (((maxVal - min) / (max - min)) * 100) + '%';
        
        // 텍스트 업데이트
        const minAgeText = minVal < 20 ? "10대" : `${minVal}대`;
        const maxAgeText = maxVal > 60 ? "60대 이상" : `${maxVal}대`;
        this.dom.ageDisplay.textContent = `${minAgeText} - ${maxAgeText}`;
    }

    async generateGuide() {
        this.showLoading(true, 'AI가 디자인 시스템을 생성 중입니다...');
        try {
            const purpose = Array.from(document.querySelectorAll('input[name="purpose"]:checked')).map(el => el.value).join(', ');
            const mood = Array.from(document.querySelectorAll('input[name="mood"]:checked')).map(el => el.value).join(', ');
            if (!purpose || !mood) { ErrorHandler.handle(new Error("서비스 목적과 분위기를 하나 이상 선택해주세요."), "입력 오류"); return; }
            const inputs = { purpose, mood, age: this.dom.ageDisplay.textContent, keywords: document.getElementById('keywords').value };
            const result = await OpenAIService.generateGuide(inputs);
            this.displayGuideResults(result);
        } catch (error) { ErrorHandler.handle(error, 'AI 가이드 생성'); } finally { this.showLoading(false); }
    }
    displayGuideResults(result) {
        const { fontSystem, colorSystem } = result;
        this.dom.guideResultSection.classList.add('show');
        let html = `<div class="font-system-card"><div class="card-header"><i class="fas fa-font"></i> 폰트 시스템</div>${Object.entries(fontSystem).map(([key, value]) => { if (typeof value === 'object') return `<div class="font-item"><span class="font-item-label">${key}</span><span>${value.fontFamily}, ${value.fontSize}, ${value.fontWeight}</span></div>`; return ''; }).join('')}<p class="font-guideline">${fontSystem.guideline}</p></div><div class="color-system-card"><div class="card-header"><i class="fas fa-palette"></i> 색상 시스템</div>${colorSystem.map(color => this.createColorComboHTML(color)).join('')}</div>`;
        this.dom.guideResultSection.innerHTML = html;
    }
    createColorComboHTML(color) {
        const contrastWithWhite = this.analyzer.getContrast(color.hex, '#FFFFFF'); const contrastWithBlack = this.analyzer.getContrast(color.hex, '#000000');
        const bestTextColor = contrastWithWhite > contrastWithBlack ? '#FFFFFF' : '#000000'; const bestContrast = Math.max(contrastWithWhite, contrastWithBlack);
        const rating = this.analyzer.getWCAGRating(bestContrast);
        return `<div class="color-item"><div class="color-item-header"><div class="color-swatch-lg" style="background-color:${color.hex};"></div><div class="color-info"><h5>${color.name} (${color.hex})</h5><p>${color.usage}</p></div></div><div class="color-combinations"><div class="combo-card"><div class="combo-preview" style="background-color:${color.hex}; color:${bestTextColor};">Aa</div><div class="combo-details"><strong>${bestContrast.toFixed(2)}:1</strong> <span class="wcag-badge wcag-${rating.toLowerCase()}">${rating}</span></div></div></div></div>`;
    }
    handleFile(file) { if (!file || !file.type.includes('html')) return ErrorHandler.handle(new Error('HTML 파일만 업로드 가능합니다.'), '파일 처리'); this.uploadedFile = file; this.dom.statusIndicator.classList.add('show'); this.dom.statusText.textContent = `준비 완료: ${file.name}`; this.dom.analyzeBtn.style.display = 'inline-flex'; this.dom.uploadArea.style.display = 'none'; }
    async runAnalysis() {
        if (!this.uploadedFile) return;
        this.dom.statusText.textContent = '분석 중...'; this.showLoading(true, 'HTML 파일을 분석 중입니다...');
        try {
            const htmlContent = await this.uploadedFile.text();
            const parser = new DOMParser(), doc = parser.parseFromString(htmlContent, 'text/html');
            const cssLinks = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(link => link.outerHTML).join('');
            document.getElementById('previewFrame').srcdoc = cssLinks + doc.body.innerHTML;
            document.getElementById('previewFrame').onload = () => {
                const iframeDoc = document.getElementById('previewFrame').contentDocument;
                const analysisResult = this.analyzer.analyze(iframeDoc);
                this.displayFeedbackDashboard(analysisResult);
                this.dom.statusIndicator.style.display = 'none';
                this.dom.analysisResults.classList.add('show');
                this.showLoading(false);
            };
        } catch (error) { ErrorHandler.handle(error, '분석'); this.showLoading(false); }
    }
    displayFeedbackDashboard(result) {
        this.dom.analysisResults.innerHTML = `<div class="metric-card"><h4><i class="fas fa-font"></i> 일관성</h4><ul class="consistency-list"><li><span>사용된 폰트 종류</span> <strong>${result.consistency.fontCount}개</strong></li><li><span>사용된 글자 색상</span> <strong>${result.consistency.colorCount}개</strong></li></ul></div><div class="metric-card"><h4><i class="fas fa-ruler-vertical"></i> 줄 간격 (예시)</h4><div class="gauge-container"><div class="gauge-fill gauge-good" style="width: 80%;"></div></div></div><h4>개선 제안 (${result.elements.length}개)</h4>`;
    }
    async sendChatMessage() {
        const message = this.dom.chatInput.value.trim(); if (!message) return;
        this.addChatMessage('user', message); this.chatHistory.push({ role: 'user', content: message });
        this.dom.chatInput.value = ''; this.showLoading(true, 'AI 팀장님이 답변을 생각 중입니다...');
        try {
            const reply = await OpenAIService.getChatReply(this.chatHistory);
            this.chatHistory.push({ role: 'assistant', content: reply });
            this.typeMessage(reply);
        } catch (error) { ErrorHandler.handle(error, '챗봇'); } finally { this.showLoading(false); }
    }
    addChatMessage(role, text) { const msgDiv = document.createElement('div'); msgDiv.className = `message ${role}`; msgDiv.textContent = text; this.dom.chatMessages.appendChild(msgDiv); this.dom.chatMessages.scrollTop = this.dom.chatMessages.scrollHeight; return msgDiv; }
    typeMessage(text) {
        const msgDiv = this.addChatMessage('ai', ''); msgDiv.classList.add('typing'); let i = 0;
        const interval = setInterval(() => {
            if (i < text.length) { msgDiv.textContent += text.charAt(i); i++; this.dom.chatMessages.scrollTop = this.dom.chatMessages.scrollHeight; }
            else { clearInterval(interval); msgDiv.classList.remove('typing'); }
        }, 25);
    }
    switchTab(tabId) { this.dom.pages.forEach(page => page.classList.remove('active')); this.dom.tabBtns.forEach(btn => btn.classList.remove('active')); document.getElementById(`${tabId}-page`).classList.add('active'); document.querySelector(`[data-tab="${tabId}"]`).classList.add('active'); }
    showLoading(show, text = '처리 중...') { this.dom.loadingText.textContent = text; this.dom.loadingOverlay.classList.toggle('show', show); }
}

document.addEventListener('DOMContentLoaded', () => { try { window.typoLabApp = new TypoLab(); } catch (error) { ErrorHandler.handle(error, "앱 시작"); } });