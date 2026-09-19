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

class _DashboardScreenState extends State<DashboardScreen> {
  final TextEditingController _apiKeyController = TextEditingController();
  final TextEditingController _inputController = TextEditingController();
  
  String _assistantStatus = "Siap membantu pekerjaan Anda.";
  String _aiResponse = "";
  bool _isLoading = false;

  Future<void> _askGemini(String prompt) async {
    final apiKey = _apiKeyController.text.trim();
    if (apiKey.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Harap masukkan Gemini API Key terlebih dahulu.')),
      );
      return;
    }

    setState(() {
      _isLoading = true;
      _assistantStatus = "Aura sedang berpikir dan menganalisis data...";
      _aiResponse = "";
    });

    try {
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
                {
                  'text': 'Anda adalah Aura, asisten kerja cerdas adaptif. Bantu tugas berikut secara profesional, ringkas, dan jelas:\n\n$prompt'
                }
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
          _assistantStatus = "Tugas berhasil diselesaikan.";
        });
      } else {
        setState(() {
          _assistantStatus = "Terjadi kesalahan API (${res.statusCode})";
          _aiResponse = "Detail error: ${res.body}";
        });
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
              // Avatar Header
              Semantics(
                liveRegion: true,
                label: 'Status Asisten AI: $_assistantStatus',
                child: Container(
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
              ),
              const SizedBox(height: 16),

              // Input API Key
              TextField(
                controller: _apiKeyController,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: 'Gemini API Key',
                  hintText: 'Tempel AI Studio Key di sini...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  prefixIcon: const Icon(Icons.key),
                ),
              ),
              const SizedBox(height: 16),

              // Input Tugas
              TextField(
                controller: _inputController,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: 'Tugas / Draf Email / Pertanyaan',
                  hintText: 'Contoh: Buatkan balasan email konfirmasi rapat proyek dengan ramah...',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 12),

              // Tombol Kirim
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0284C7),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 50),
                ),
                onPressed: _isLoading ? null : () => _askGemini(_inputController.text),
                icon: const Icon(Icons.send),
                label: const Text('Kirim ke Aura AI'),
              ),
              const SizedBox(height: 20),

              // Hasil Output
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
                        '💡 Hasil Analisis & Respons:',
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
