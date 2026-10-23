{% raw %}
{{/* Common labels; preview releases get an extra label so they are easy to find. */}}
{{- define "service.labels" -}}
app: {{ .Release.Name }}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Values.preview.enabled }}
idp.io/preview: "true"
{{- end }}
{{- end }}

{{- define "service.selectorLabels" -}}
app: {{ .Release.Name }}
{{- end }}
{% endraw %}
