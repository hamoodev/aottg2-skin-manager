package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

var apiBase = envOrDefault("API_BASE", "https://api.aottg2-skin-manager.hamood.dev")
var cdnBase = envOrDefault("CDN_BASE", "https://cdn.hamood.dev")

func envOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// OpenURL opens a URL in the user's default browser.
func (a *App) OpenURL(u string) {
	wailsRuntime.BrowserOpenURL(a.ctx, u)
}

// LoginWithDiscord starts the Discord OAuth flow by opening the browser and
// capturing the token via a temporary local HTTP callback server.
// Requires the API to support ?redirect_to= query param on /api/auth/discord.
func (a *App) LoginWithDiscord() (string, error) {
	tokenCh := make(chan string, 1)
	errCh := make(chan error, 1)

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", fmt.Errorf("could not start auth listener: %w", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port

	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		token := r.URL.Query().Get("token")
		if token == "" {
			w.Header().Set("Content-Type", "text/html")
			w.Write([]byte(`<!DOCTYPE html><html><body style="background:#1a1a2e;color:#c93545;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h2>Login failed — no token received.</h2></body></html>`))
			errCh <- fmt.Errorf("no token in callback")
			return
		}
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(`<!DOCTYPE html><html><body style="background:#1a1a2e;color:#2d8a6e;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h2>&#10003; Login successful! You can close this tab.</h2></body></html>`))
		tokenCh <- token
	})

	server := &http.Server{Handler: mux}
	go server.Serve(listener)

	redirectTo := fmt.Sprintf("http://127.0.0.1:%d/callback", port)
	authURL := fmt.Sprintf("%s/api/auth/discord?redirect_to=%s", apiBase, url.QueryEscape(redirectTo))
	wailsRuntime.BrowserOpenURL(a.ctx, authURL)

	var token string
	select {
	case token = <-tokenCh:
	case err := <-errCh:
		server.Close()
		return "", err
	case <-time.After(5 * time.Minute):
		server.Close()
		return "", fmt.Errorf("login timed out")
	}

	server.Close()
	return token, nil
}

// UploadImage opens a native file picker, uploads the selected image to S3 via
// a presigned URL, and returns the S3 key and CDN URL.
func (a *App) UploadImage(token string) (map[string]string, error) {
	selected, err := wailsRuntime.OpenFileDialog(a.ctx, wailsRuntime.OpenDialogOptions{
		Title: "Select Image",
		Filters: []wailsRuntime.FileFilter{
			{DisplayName: "Images", Pattern: "*.png;*.jpg;*.jpeg;*.webp"},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("file dialog error: %w", err)
	}
	if selected == "" {
		return nil, nil // user cancelled
	}

	fileBytes, err := os.ReadFile(selected)
	if err != nil {
		return nil, fmt.Errorf("could not read file: %w", err)
	}

	contentType := http.DetectContentType(fileBytes)
	switch contentType {
	case "image/png", "image/jpeg", "image/webp":
		// ok
	default:
		return nil, fmt.Errorf("unsupported image type: %s", contentType)
	}

	filename := filepath.Base(selected)

	// Request presigned URL
	presignBody, _ := json.Marshal(map[string]string{
		"filename":    filename,
		"contentType": contentType,
	})
	presignReq, err := http.NewRequest("POST", apiBase+"/api/upload/presign", bytes.NewReader(presignBody))
	if err != nil {
		return nil, fmt.Errorf("could not create presign request: %w", err)
	}
	presignReq.Header.Set("Content-Type", "application/json")
	presignReq.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 30 * time.Second}
	presignResp, err := client.Do(presignReq)
	if err != nil {
		return nil, fmt.Errorf("presign request failed: %w", err)
	}
	defer presignResp.Body.Close()

	if presignResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(presignResp.Body)
		return nil, fmt.Errorf("presign failed (%d): %s", presignResp.StatusCode, string(body))
	}

	var presignData struct {
		UploadURL string `json:"uploadUrl"`
		Key       string `json:"key"`
	}
	if err := json.NewDecoder(presignResp.Body).Decode(&presignData); err != nil {
		return nil, fmt.Errorf("could not parse presign response: %w", err)
	}

	// Upload to S3
	putReq, err := http.NewRequest("PUT", presignData.UploadURL, bytes.NewReader(fileBytes))
	if err != nil {
		return nil, fmt.Errorf("could not create S3 upload request: %w", err)
	}
	putReq.Header.Set("Content-Type", contentType)

	putResp, err := client.Do(putReq)
	if err != nil {
		return nil, fmt.Errorf("S3 upload failed: %w", err)
	}
	defer putResp.Body.Close()

	if putResp.StatusCode < 200 || putResp.StatusCode >= 300 {
		body, _ := io.ReadAll(putResp.Body)
		return nil, fmt.Errorf("S3 upload failed (%d): %s", putResp.StatusCode, string(body))
	}

	cdnURL := ""
	if cdnBase != "" {
		cdnURL = cdnBase + "/" + presignData.Key
	}

	return map[string]string{
		"key": presignData.Key,
		"url": cdnURL,
	}, nil
}

func skinsPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("could not find home directory: %w", err)
	}
	candidates := []string{
		filepath.Join(home, "Documents", "Aottg2", "Settings", "CustomSkins.json"),
		filepath.Join(home, "OneDrive", "Documents", "Aottg2", "Settings", "CustomSkins.json"),
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p, nil
		}
	}
	// Default to the first path if neither exists yet
	return candidates[0], nil
}

func readSkinsFile() (map[string]json.RawMessage, error) {
	p, err := skinsPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(p)
	if err != nil {
		return nil, fmt.Errorf("could not read CustomSkins.json: %w", err)
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("could not parse CustomSkins.json: %w", err)
	}
	return raw, nil
}

func writeSkinsFile(raw map[string]json.RawMessage) error {
	p, err := skinsPath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(raw, "", "  ")
	if err != nil {
		return fmt.Errorf("could not marshal JSON: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(p), 0755); err != nil {
		return fmt.Errorf("could not create directory: %w", err)
	}
	if err := os.WriteFile(p, data, 0644); err != nil {
		return fmt.Errorf("could not write CustomSkins.json: %w", err)
	}
	return nil
}

// GetSkins reads CustomSkins.json and returns the parsed data.
func (a *App) GetSkins() (map[string]interface{}, error) {
	raw, err := readSkinsFile()
	if err != nil {
		return nil, err
	}
	result := make(map[string]interface{})
	for k, v := range raw {
		var parsed interface{}
		if err := json.Unmarshal(v, &parsed); err != nil {
			return nil, fmt.Errorf("could not parse category %s: %w", k, err)
		}
		result[k] = parsed
	}
	return result, nil
}

// DeleteSet removes a set by UniqueId from the specified category.
func (a *App) DeleteSet(category string, uniqueId string) error {
	raw, err := readSkinsFile()
	if err != nil {
		return err
	}
	catRaw, ok := raw[category]
	if !ok {
		return fmt.Errorf("category %q not found", category)
	}
	var catData map[string]json.RawMessage
	if err := json.Unmarshal(catRaw, &catData); err != nil {
		return fmt.Errorf("could not parse category %s: %w", category, err)
	}
	setsRaw, ok := catData["Sets"]
	if !ok {
		return fmt.Errorf("no Sets found in category %s", category)
	}
	var sets []map[string]interface{}
	if err := json.Unmarshal(setsRaw, &sets); err != nil {
		return fmt.Errorf("could not parse Sets: %w", err)
	}
	filtered := make([]map[string]interface{}, 0, len(sets))
	found := false
	for _, set := range sets {
		if id, ok := set["UniqueId"].(string); ok && id == uniqueId {
			found = true
			continue
		}
		filtered = append(filtered, set)
	}
	if !found {
		return fmt.Errorf("set with UniqueId %q not found in %s", uniqueId, category)
	}
	setsBytes, err := json.Marshal(filtered)
	if err != nil {
		return fmt.Errorf("could not marshal filtered sets: %w", err)
	}
	catData["Sets"] = json.RawMessage(setsBytes)
	catBytes, err := json.Marshal(catData)
	if err != nil {
		return fmt.Errorf("could not marshal category: %w", err)
	}
	raw[category] = json.RawMessage(catBytes)
	return writeSkinsFile(raw)
}

// CreateSet creates a new set with default fields for the given category.
func (a *App) CreateSet(category string, name string) (map[string]interface{}, error) {
	raw, err := readSkinsFile()
	if err != nil {
		return nil, err
	}
	catRaw, ok := raw[category]
	if !ok {
		return nil, fmt.Errorf("category %q not found", category)
	}
	var catData map[string]json.RawMessage
	if err := json.Unmarshal(catRaw, &catData); err != nil {
		return nil, fmt.Errorf("could not parse category %s: %w", category, err)
	}
	setsRaw, ok := catData["Sets"]
	if !ok {
		return nil, fmt.Errorf("no Sets found in category %s", category)
	}
	var sets []map[string]interface{}
	if err := json.Unmarshal(setsRaw, &sets); err != nil {
		return nil, fmt.Errorf("could not parse Sets: %w", err)
	}

	newSet := makeDefaultSet(category, name)

	sets = append(sets, newSet)
	setsBytes, err := json.Marshal(sets)
	if err != nil {
		return nil, fmt.Errorf("could not marshal sets: %w", err)
	}
	catData["Sets"] = json.RawMessage(setsBytes)
	catBytes, err := json.Marshal(catData)
	if err != nil {
		return nil, fmt.Errorf("could not marshal category: %w", err)
	}
	raw[category] = json.RawMessage(catBytes)
	if err := writeSkinsFile(raw); err != nil {
		return nil, err
	}
	return newSet, nil
}

// UpdateSet updates a single set's fields by UniqueId.
func (a *App) UpdateSet(category string, uniqueId string, fields map[string]interface{}) error {
	raw, err := readSkinsFile()
	if err != nil {
		return err
	}
	catRaw, ok := raw[category]
	if !ok {
		return fmt.Errorf("category %q not found", category)
	}
	var catData map[string]json.RawMessage
	if err := json.Unmarshal(catRaw, &catData); err != nil {
		return fmt.Errorf("could not parse category %s: %w", category, err)
	}
	setsRaw, ok := catData["Sets"]
	if !ok {
		return fmt.Errorf("no Sets found in category %s", category)
	}
	var sets []map[string]interface{}
	if err := json.Unmarshal(setsRaw, &sets); err != nil {
		return fmt.Errorf("could not parse Sets: %w", err)
	}
	found := false
	for i, set := range sets {
		if id, ok := set["UniqueId"].(string); ok && id == uniqueId {
			for k, v := range fields {
				sets[i][k] = v
			}
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("set with UniqueId %q not found in %s", uniqueId, category)
	}
	setsBytes, err := json.Marshal(sets)
	if err != nil {
		return fmt.Errorf("could not marshal sets: %w", err)
	}
	catData["Sets"] = json.RawMessage(setsBytes)
	catBytes, err := json.Marshal(catData)
	if err != nil {
		return fmt.Errorf("could not marshal category: %w", err)
	}
	raw[category] = json.RawMessage(catBytes)
	return writeSkinsFile(raw)
}

func makeDefaultSet(category string, name string) map[string]interface{} {
	id := uuid.New().String()
	switch category {
	case "Human":
		return map[string]interface{}{
			"Hair":          "",
			"Eye":           "",
			"Glass":         "",
			"Face":          "",
			"Skin":          "",
			"Costume":       "",
			"Logo":          "",
			"GearL":         "",
			"GearR":         "",
			"Gas":           "",
			"Hoodie":        "",
			"WeaponTrail":   "",
			"Horse":         "",
			"ThunderspearL": "",
			"ThunderspearR": "",
			"HookL":         "",
			"HookLTiling":   float64(1),
			"HookR":         "",
			"HookRTiling":   float64(1),
			"Hat":           "",
			"Head":          "",
			"Back":          "",
			"Name":          name,
			"Preset":        false,
			"UniqueId":      id,
		}
	case "Titan":
		eightEmpty := make([]interface{}, 8)
		for i := range eightEmpty {
			eightEmpty[i] = ""
		}
		eightNeg1 := make([]interface{}, 8)
		for i := range eightNeg1 {
			eightNeg1[i] = float64(-1)
		}
		eightEmptyStr := make([]interface{}, 8)
		for i := range eightEmptyStr {
			eightEmptyStr[i] = ""
		}
		return map[string]interface{}{
			"RandomizedPairs": false,
			"Hairs":           eightEmpty,
			"HairModels":      eightNeg1,
			"Bodies":          eightEmpty,
			"BodyModels":      eightEmptyStr,
			"Heads":           eightEmpty,
			"HeadModels":      eightNeg1,
			"Eyes":            eightEmpty,
			"Name":            name,
			"Preset":          false,
			"UniqueId":        id,
		}
	case "Shifter":
		return map[string]interface{}{
			"Eren":     "",
			"Annie":    "",
			"Colossal": "",
			"Name":     name,
			"Preset":   false,
			"UniqueId": id,
		}
	case "Skybox":
		return map[string]interface{}{
			"Front":    "",
			"Back":     "",
			"Left":     "",
			"Right":    "",
			"Up":       "",
			"Down":     "",
			"Name":     name,
			"Preset":   false,
			"UniqueId": id,
		}
	default:
		return map[string]interface{}{
			"Name":     name,
			"Preset":   false,
			"UniqueId": id,
		}
	}
}
