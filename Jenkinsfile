pipeline {
    agent {
        label 'docker'
    }

    environment {
        DOCKER_BUILDKIT = 1 // Experimental faster build system
        REPO_NAME = "gauzy"
        IMAGE_API = "gauzy-api"
        IMAGE_WEBAPP = "gauzy-webapp"
        GITHUB_DOCKER_USERNAME = credentials('github-docker-username')
        GITHUB_DOCKER_PASSWORD = credentials('github-docker-password')
        GITHUB_DOCKER_REPO = "docker.pkg.github.com/ever-co/gauzy"
        GITHUB_TOKEN = credentials('github-token')
        CI_URL = "ci.ever.co"
        AWS_ACCESS_KEY_ID = credentials('aws-access-key')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-key')
        AWS_DEFAULT_REGION = "us-east-1"
        AWS_ECR_REPO = """${sh(
            script: "aws ecr get-login --no-include-email --region ${env.AWS_DEFAULT_REGION} | grep -o 'https://.*' | sed -e 's|https://||g' | tr -d '\n'",
            returnStdout: true
        )}"""
        AWS_ECR_PASSWORD = """${sh(
            script: "aws ecr get-login-password --region ${env.AWS_DEFAULT_REGION}",
            returnStdout: true
        )}"""
    }

    stages {
        stage("Clone") {
            steps{
                git branch: 'develop',
                    url: 'https://github.com/ever-co/gauzy.git'
            }
            post {
                success {
                    echo "Cloning successful..."
                }
                failure {
                    echo "Cloning failed! See log for details. Terminating..."
                }
            }
        }
        stage("Docker Image Build") {
            parallel {
                stage("API Image") {
                    steps {
                        sh "docker build -t ${env.IMAGE_API} -f .deploy/api/Dockerfile ."
                    }
                    post{
                        success {
                            echo "Image for API built!"
                        }
                        failure {
                            echo "API Image build failed..."
                        }
                    }
                }
                stage("Gauzy WebApp Image") {
                    steps {
                        sh "docker build -t ${env.IMAGE_WEBAPP} -f .deploy/webapp/Dockerfile ."
                    }
                    post {
                        success {
                            echo "Image for Webapp built!"
                        }
                        failure {
                            echo "Webapp image build failed..."
                        }
                    }
                }
            }
        }
        stage("Login to repositories") {
            steps {
                sh "docker login docker.pkg.github.com -u ${GITHUB_DOCKER_USERNAME} -p ${GITHUB_DOCKER_PASSWORD}"
                sh "docker login ${AWS_ECR_REPO} -u AWS -p ${AWS_ECR_PASSWORD}" // Login to AWS ECR
            }
        }
        stage ("Push To AWS ECR") {
            parallel {
                stage ("API Image") {
                    steps {
                        // Tag and push to ECR
                        sh "docker tag ${IMAGE_API} ${AWS_ECR_REPO}/${IMAGE_API}"
                        sh "docker push ${AWS_ECR_REPO}/${IMAGE_API}"
                        sh "docker rmi ${AWS_ECR_REPO}/${IMAGE_API}" // Cleans tag
                    }
                    post {
                        success {
                            echo "Successfuly pushed to ECR on build ${env.BUILD_ID}!"
                        }
                        failure {
                            echo "Push to ECR failed! See log for details..."
                        }
                    }
                }
                stage ("WebApp Image") {
                    steps {
                        sh "docker tag ${IMAGE_WEBAPP} ${AWS_ECR_REPO}/${IMAGE_WEBAPP}"
                        sh "docker push ${AWS_ECR_REPO}/${IMAGE_WEBAPP}"
                        sh "docker rmi ${AWS_ECR_REPO}/${IMAGE_WEBAPP}" // Cleans tag
                    }
                    post {
                        success {
                            echo "Successfully pushed to ECR on build ${env.BUILD_ID}!"
                        }
                        failure {
                            echo "Push to ECR failed! See log for details..."
                        }
                    }
                }
            }
        }
        stage ("Push to GitHub") {
            parallel {
                stage ("API Image") {
                    steps {
                        sh "docker tag ${IMAGE_API} ${GITHUB_DOCKER_REPO}/${IMAGE_API}"
                        sh "docker push ${GITHUB_DOCKER_REPO}/${IMAGE_API}"
                        sh "docker rmi ${GITHUB_DOCKER_REPO}/${IMAGE_API}"
                    }
                    post {
                        success {
                            echo "Successfully pushed to GitHub on build ${env.BUILD_ID}!"
                        }
                        failure {
                            echo "Push to GitHub failed! See log for details..."
                        }
                    }
                }
                stage ("WebApp Image") {
                    steps {
                        sh "docker tag ${IMAGE_WEBAPP} ${GITHUB_DOCKER_REPO}/${IMAGE_WEBAPP}"
                        sh "docker push ${GITHUB_DOCKER_REPO}/${IMAGE_WEBAPP}"
                        sh "docker rmi ${GITHUB_DOCKER_REPO}/${IMAGE_WEBAPP}"
                    }
                    post {
                        success {
                            echo "Successfully pushed to GitHub on build ${env.BUILD_ID}!"
                        }
                        failure {
                            echo "Push to GitHub failed! See log for details..."
                        }
                    }
                }
            }
        }
    }
    post {
        success {
            echo "Gauzy CI/CD pipeline executed successfully!"
            sh "curl 'https://api.github.com/repos/ever-co/${REPO_NAME}/statuses/$GIT_COMMIT' -H 'Authorization: token ${GITHUB_TOKEN}' -H 'Content-Type: application/json' -X POST -d \"{\"state\": \"success\",\"context\": \"Jenkins\", \"description\": \"Jenkins pipeline succeeded\", \"target_url\": \"http://$CI_URL/job/${JOB_NAME}/$BUILD_NUMBER/console\"}\""
		}
        failure {
            echo "Gauzy CI/CD pipeline failed..."
			sh "curl 'https://api.github.com/repos/ever-co/${REPO_NAME}/statuses/$GIT_COMMIT' -H 'Authorization: token ${GITHUB_TOKEN}' -H 'Content-Type: application/json' -X POST -d \"{\"state\": \"failure\",\"context\": \"Jenkins\", \"description\": \"Jenkins pipeline failed\", \"target_url\": \"http://$CI_URL/job/${JOB_NAME}/$BUILD_NUMBER/console\"}\""
        }
    }
}