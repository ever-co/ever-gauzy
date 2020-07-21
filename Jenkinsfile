pipeline {
    agent {
        label 'docker'
    }

    environment {
        DOCKER_BUILDKIT = 1 // Experimental faster build system
        IMAGE_API = "gauzy/api"
        IMAGE_WEBAPP = "gauzy/webapp"
        GITHUB_DOCKER_USERNAME = credentials('github-docker-username')
        GITHUB_DOCKER_PASSWORD = credentials('github-docker-password')
        AWS_ACCESS_KEY_ID = credentials('aws-access-key')
        AWS_SECRET_ACCESS_KEY = credentials('aws-secret-key')
        AWS_DEFAULT_REGION = "us-east-1"
        AWS_ECR = """${sh(
                  returnStdout: true,
                  script: "\$(echo \$(aws ecr get-login --no-include-email | grep -o 'https://.*' | sed 's|https://||g'))"
                  )}
                  """
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
                sh "docker login docker.pkg.github.com -u ${env.GITHUB_DOCKER_USERNAME} -p ${env.GITHUB_DOCKER_PASSWORD}"
            }
            steps {
                script {
                    sh("eval \$(aws ecr get-login --no-include-email | sed 's|https://||')")
                } // Login to AWS ECR
            }
        }
        stage ("Docker Image Push") {
            parallel {
                stage ("Push API Image") {
                    steps {
                        sh "docker tag ${env.IMAGE_API} docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_API}:latest"
                        sh "docker push docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_API}:latest"
                    }
                    steps {
                        // Tag and push to ECR
                        sh "docker tag docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_API}:latest ${env.AWS_ECR}/${env.IMAGE_API}"
                        sh "docker push ${env.AWS_ECR}/${env.IMAGE_API}"
                    }
                    post {
                        success {
                            echo "API image successfully pushed to repository!"
                        }
                        failure {
                            echo "Image push failed! See log for details..."
                        }
                    }
                }
                stage ("Push WebApp Image") {
                    steps {
                        sh "docker tag ${env.IMAGE_WEBAPP} docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_WEBAPP}:latest"
                        sh "docker push docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_WEBAPP}:latest"
                    }
                    steps {
                        // Tag and push to ECR
                        sh "docker tag docker.pkg.github.com/ever-co/gauzy/${env.IMAGE_WEBAPP}:latest ${env.AWS_ECR}/${env.IMAGE_WEBAPP}"
                        sh "docker push ${env.AWS_ECR}/${env.IMAGE_WEBAPP}"
                    }
                    post {
                        success {
                            echo "WebApp image successfully pushed to repository!"
                        }
                        failure {
                            echo "Image push failed! See log for details..."
                        }
                    }
                }
            }
        }
    }
    post {
        success {
            echo "Gauzy CI/CD pipeline executed successfully!"
        }
        failure {
            echo "Gauzy CI/CD pipeline failed..."
        }
    }
}