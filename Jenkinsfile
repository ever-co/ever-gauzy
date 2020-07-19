pipeline {
    agent {
        label 'docker'
    }

    environment {
        DOCKER_BUILDKIT = 1 // Experimental faster build system
        IMAGE_API = "Gauzy-api"
        IMAGE_WEBAPP = "Gauzy-webapp"
        GITHUB_DOCKER_USERNAME = credentials('github-docker-username')
        GITHUB_DOCKER_PASSWORD = credentials('github-docker-password')
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
                        sh "docker build -t ${IMAGE_API} -f .deploy/api/Dockerfile ."
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
                        sh "docker build -t ${IMAGE_WEBAPP} -f .deploy/webapp/Dockerfile ."
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
        stage ("Docker Image Push") {
            parallel {
                stage ("Push API Image") {
                    steps {
                        sh ""
                        sh "docker tag ${IMAGE_API} docker.pkg.github.com/ever-co/gauzy/${IMAGE_API}:latest"
                        sh "docker push docker.pkg.github.com/ever-co/gauzy/${IMAGE_API}:latest"
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
                        sh "docker login docker.pkg.github.com -u ${GITHUB_DOCKER_USERNAME} -p ${GITHUB_DOCKER_PASSWORD}"
                        sh "docker tag ${IMAGE_WEBAPP} docker.pkg.github.com/ever-co/gauzy/${IMAGE_WEBAPP}:latest"
                        sh "docker push docker.pkg.github.com/ever-co/gauzy/${IMAGE_WEBAPP}:latest"
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