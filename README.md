# AI-Powered IT Service Operations Intelligence Platform

React + TypeScript frontend, FastAPI backend, PostgreSQL database. No Streamlit.

## Features
- Ticket KPI dashboard: volume, open tickets, SLA compliance, average resolution time, CSAT
- Ticket search/filter and ticket creation
- Team and customer breakdowns
- Explainable rule-based ticket SLA-risk estimator
- Synthetic demo data generator
- Docker Compose local development
- AWS deployment guide: S3 frontend + EC2 FastAPI + RDS PostgreSQL

> The risk estimator in this starter is rule-based, not a trained ML model. It is transparent and suitable as a baseline. Replace it with a validated model when you have labelled historical data.

## 1. Requirements
- Python 3.11+
- Node.js 20+
- Docker Desktop (recommended for local setup)
- AWS CLI v2 (for AWS deployment)
- An AWS account with billing alerts enabled

## 2. Run locally with Docker (recommended)
From this folder:

```bash
docker compose up --build
```

Open:
- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

The backend automatically creates tables and seeds 500 synthetic tickets on first startup if the database is empty.

Stop:
```bash
docker compose down
```
Remove local database data:
```bash
docker compose down -v
```

## 3. Run without Docker

### Backend
```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
```

Set the database URL (example local PostgreSQL):
```powershell
$env:DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/serviceops"
```
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
In a second terminal:
```bash
cd frontend
npm install
```
Create `.env` from `.env.example` and set:
```env
VITE_API_BASE_URL=http://localhost:8000
```
Then:
```bash
npm run dev
```

## 4. Windows project path
If using the requested Windows folder:
```powershell
cd "D:\Project\AI-Powered-IT-Service-Operations-Intelligence-Platform"
```
Extract this ZIP into that directory so `backend`, `frontend`, and `docker-compose.yml` are directly inside it.

## 5. AWS low-cost architecture

Browser -> S3 static website (React build) -> EC2 (FastAPI) -> RDS PostgreSQL.

Recommended demo topology:
- One small EC2 instance (for example, a currently eligible micro instance) running FastAPI with Docker.
- One small RDS PostgreSQL instance, single-AZ, not publicly accessible.
- RDS and EC2 in the same VPC. Permit PostgreSQL port 5432 only from the EC2 security group.
- S3 bucket for frontend build output.
- Use HTTPS through CloudFront + ACM for a real public portfolio. S3 website endpoints themselves are HTTP-only.
- Do not use real customer, employee, patient, or production ticket data in this demo.

AWS Free Tier is not guaranteed for every account or region. Instance availability, eligibility and free allowances change. Check the AWS Pricing Calculator and your account's Free Tier page before provisioning. RDS, EC2, public IPv4, storage, snapshots, data transfer and CloudFront can incur charges. Set an AWS Budget alert before deployment.

## 6. Provision AWS resources (console-first, safer for beginners)

### A. Create a VPC / security groups
You can use the default VPC for a learning demo, but a dedicated VPC is better.
1. Create an EC2 security group `serviceops-api-sg`.
2. Add inbound TCP 22 only from **your current public IP** (temporary administration).
3. Add inbound TCP 8000 from the frontend's access pattern only if you are testing directly. For production, put the API behind an HTTPS reverse proxy/load balancer and expose 443 only.
4. Create an RDS security group `serviceops-db-sg`.
5. Add inbound TCP 5432 with source set to `serviceops-api-sg` (not `0.0.0.0/0`).

### B. Create RDS PostgreSQL
1. Open RDS -> Create database -> Standard create -> PostgreSQL.
2. Choose a small instance class eligible for your account/region; choose Single-AZ for demo.
3. Set storage to the smallest suitable amount; disable storage autoscaling for a tightly controlled demo if appropriate.
4. Set database name `serviceops`, master username, and a strong unique password.
5. Choose the VPC and `serviceops-db-sg`.
6. Set **Public access: No**.
7. Enable automated backups only if the cost/retention is acceptable.
8. Create the database and copy its endpoint.

### C. Create EC2
1. Launch a small Amazon Linux instance.
2. Attach `serviceops-api-sg`.
3. Use an SSH key pair and keep the private key private.
4. Connect by SSH.
5. Install Docker (commands below), then deploy the backend.

For Amazon Linux 2023:
```bash
sudo dnf update -y
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```
Log out and reconnect so the Docker group applies.

### D. Configure backend environment on EC2
Clone or upload this project to EC2. In the project root:
```bash
cd backend
```
Create an environment file:
```bash
nano .env
```
Set values (replace placeholders):
```env
DATABASE_URL=postgresql+psycopg://DB_USER:URL_ENCODED_DB_PASSWORD@RDS_ENDPOINT:5432/serviceops
CORS_ORIGINS=https://YOUR_FRONTEND_DOMAIN
```
If the password contains reserved URL characters, URL-encode it. Do not commit `.env` to Git.

Build and run:
```bash
docker build -t serviceops-api .
docker run -d --name serviceops-api --restart unless-stopped \
  --env-file .env -p 8000:8000 serviceops-api
```
Check:
```bash
curl http://localhost:8000/health
docker logs -f serviceops-api
```
For a public production deployment, do not leave port 8000 open to the internet. Put Nginx/Caddy with HTTPS in front of FastAPI, or use an HTTPS load balancer/API service. Restrict inbound access appropriately.

### E. Build and upload frontend to S3
Create an S3 bucket with a globally unique name. For a quick demo you may enable static website hosting and public read access, but this is not recommended for production. Prefer CloudFront with Origin Access Control for production.

On your development computer:
```powershell
cd frontend
npm install
```
Create `.env.production`:
```env
VITE_API_BASE_URL=http://YOUR_EC2_PUBLIC_DNS:8000
```
For production, use an HTTPS API domain instead of HTTP.
Build:
```powershell
npm run build
```
Upload the generated `dist` folder:
```powershell
aws s3 sync dist/ s3://YOUR-UNIQUE-FRONTEND-BUCKET/ --delete
```
If using S3 static website hosting, configure `index.html` as the index document. The S3 website endpoint is HTTP-only. For HTTPS, use CloudFront + OAC and a certificate in ACM (us-east-1 for CloudFront).

## 7. API endpoints
- `GET /health`
- `GET /api/v1/summary`
- `GET /api/v1/tickets?limit=100&status=Open&priority=High&search=VPN`
- `POST /api/v1/tickets`
- `GET /api/v1/insights`
- `POST /api/v1/predict-risk`

Example create ticket:
```json
{
  "ticket_number": "INC-90001",
  "title": "VPN access unavailable",
  "description": "Remote users cannot connect to VPN",
  "category": "Network",
  "priority": "High",
  "status": "In Progress",
  "team": "Infrastructure",
  "customer": "Northwind",
  "created_at": "2026-10-01T10:00:00Z",
  "resolved_at": null,
  "sla_target_hours": 8,
  "resolution_hours": null,
  "csat": null
}
```

## 8. Security checklist before real use
- HTTPS for frontend and API.
- Keep RDS private; DB port allowed only from API security group.
- Store secrets in AWS Secrets Manager or SSM Parameter Store, not Git or frontend variables.
- Add authentication/authorization (for example Amazon Cognito or an identity provider).
- Add rate limiting, request validation, audit logs and retention policies.
- Use IAM roles for EC2 access to AWS services; avoid long-lived access keys.
- Configure CORS to exact trusted frontend origins.
- Add backups and test restore.
- Add monitoring and cost alarms.

## 9. Cleanup to stop ongoing AWS charges
- Delete the EC2 instance.
- Delete the RDS database and choose whether to retain/delete final snapshot.
- Delete the S3 bucket contents and bucket.
- Delete unused EBS volumes, snapshots, Elastic IPs, load balancers and CloudFront distributions.
- Review Billing -> Bills after cleanup.
