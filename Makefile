build:
	./scripts/gcp-artifact-deploy.sh

deploy:
	./scripts/deploy.sh

bdeploy:
	./scripts/gcp-artifact-deploy.sh && ./scripts/deploy.sh

restart:
	kubectl delete pods -l app=runner -n k6

brestart:
	./scripts/gcp-artifact-deploy.sh && kubectl delete pods -l app=runner -n k6