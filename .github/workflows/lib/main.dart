import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const AuraApp());
}

class AuraApp extends StatelessWidget {
  const AuraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Aura AI Assistant',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0B0F19),
        primaryColor: const Color(0xFF00E5FF),
      ),
      home: const DashboardScreen(),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

enum AiProvider { geminiCloud, localOllama }

class _DashboardScreenState extends State<DashboardScreen> {
  AiProvider _selectedProvider = AiProvider.geminiCloud;

  final TextEditingController _apiKeyController = TextEditingController();
  final TextEditingController _localUrlController = TextEditingController(text: "http://localhost:11434");
  final TextEditingController _localModelController = TextEditingController(text: "llama3");
  final TextEditingController _inputController = TextEditingController();

  String _assistantStatus = "Siap membantu pekerjaan Anda.";
  String _aiResponse = "";
  bool _isLoading = false;

  Future<void> _processRequest(String prompt) async {
    if (prompt.trim().isEmpty) return;

    setState(() {
      _isLoading = true;
      _assistantStatus = _selectedProvider == AiProvider.geminiCloud
          ? "Aura sedang menghubungi Gemini Cloud..."
          : "Aura sedang memproses di Server Lokal...";
      _aiResponse = "";
    });

    try {
      if (_selectedProvider == AiProvider.geminiCloud) {
        await _askGemini(prompt);
      } else {
        await _askLocalOllama(prompt);
      }
    } catch (e) {
      setState(() {
        _assistantStatus = "Gagal terhubung ke AI.";
        _aiResponse = "Error: $e";
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  // Panggilan ke Google Gemini
  Future<void> _askGemini(String prompt) async {
    final apiKey = _apiKeyController.text.trim();
    if (apiKey.isEmpty) {
      throw Exception('Kunci API Gemini belum diisi.');
    }

    final url = Uri.parse(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$apiKey',
    );

    final res = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'contents': [
          {
            'parts': [
              {'text': 'Anda adalah Aura AI. Bantu tugas berikut secara ringkas dan profesional:\n\n$prompt'}
            ]
          }
        ]
      }),
    );

    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      final text = data['candidates'][0]['content']['parts'][0]['text'];
      setState(() {
        _aiResponse = text;
        _assistantStatus = "Tugas selesai (via Gemini Cloud).";
      });
    } else {
      throw Exception('Gemini API Error (${res.statusCode}): ${res.body}');
    }
  }

  // Panggilan ke Server Lokal (Ollama)
  Future<void> _askLocalOllama(String prompt) async {
    String baseUrl = _localUrlController.text.trim();
    if (baseUrl.endsWith('/')) baseUrl = baseUrl.substring(0, baseUrl.length - 1);
    final modelName = _localModelController.text.trim();

    final url = Uri.parse('$baseUrl/api/generate');

    final res = await http.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'model': modelName.isEmpty ? 'llama3' : modelName,
        'prompt': 'Anda adalah Aura AI. Bantu tugas berikut secara profesional:\n\n$prompt',
        'stream': false,
      }),
    );

    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      final text = data['response'];
      setState(() {
        _aiResponse = text;
        _assistantStatus = "Tugas selesai (via Server Lokal: $modelName).";
      });
    } else {
      throw Exception('Server Lokal Error (${res.statusCode}): Pastikan Ollama aktif di $baseUrl');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Aura AI Work Assistant'),
        backgroundColor: const Color(0xFF111827),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Avatar Status Header
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFF00E5FF)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: LinearGradient(
                          colors: [Color(0xFF00E5FF), Color(0xFF9333EA)],
                        ),
                      ),
                      child: const Icon(Icons.psychology, color: Colors.white, size: 30),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'AURA Neural Assistant',
                            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _assistantStatus,
                            style: const TextStyle(fontSize: 13, color: Color(0xFF38BDF8)),
                          ),
                        ],
                      ),
                    ),
                    if (_isLoading)
                      const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF00E5FF)),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Pilihan Mode Server (Cloud vs Lokal)
              Card(
                color: const Color(0xFF161F30),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "Pilih Sumber AI:",
                        style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white70),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: RadioListTile<AiProvider>(
                              title: const Text("Gemini Cloud", style: TextStyle(fontSize: 13)),
                              value: AiProvider.geminiCloud,
                              groupValue: _selectedProvider,
                              onChanged: (val) => setState(() => _selectedProvider = val!),
                            ),
                          ),
                          Expanded(
                            child: RadioListTile<AiProvider>(
                              title: const Text("Server Lokal", style: TextStyle(fontSize: 13)),
                              value: AiProvider.localOllama,
                              groupValue: _selectedProvider,
                              onChanged: (val) => setState(() => _selectedProvider = val!),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),

                      // Field input sesuai mode yang dipilih
                      if (_selectedProvider == AiProvider.geminiCloud)
                        TextField(
                          controller: _apiKeyController,
                          obscureText: true,
                          decoration: InputDecoration(
                            labelText: 'Gemini API Key',
                            hintText: 'Tempel AI Studio Key...',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            prefixIcon: const Icon(Icons.key),
                          ),
                        )
                      else ...[
                        TextField(
                          controller: _localUrlController,
                          decoration: InputDecoration(
                            labelText: 'URL Server Lokal',
                            hintText: 'http://localhost:11434',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            prefixIcon: const Icon(Icons.dns),
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: _localModelController,
                          decoration: InputDecoration(
                            labelText: 'Nama Model Lokal',
                            hintText: 'llama3 / mistral / deepseek-r1',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            prefixIcon: const Icon(Icons.memory),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Kolom Input Tugas
              TextField(
                controller: _inputController,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: 'Tugas / Email / Instruksi Kerja',
                  hintText: 'Tuliskan tugas pekerjaan atau pesan email di sini...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),

              // Tombol Eksekusi
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 50),
                ),
                onPressed: _isLoading ? null : () => _processRequest(_inputController.text),
                icon: const Icon(Icons.send),
                label: const Text('Kirim ke Aura AI'),
              ),
              const SizedBox(height: 20),

              // Area Hasil Respons
              if (_aiResponse.isNotEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '💡 Hasil Analisis & Solusi:',
                        style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF38BDF8)),
                      ),
                      const Divider(color: Colors.white24),
                      SelectableText(
                        _aiResponse,
                        style: const TextStyle(fontSize: 14, height: 1.5),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
